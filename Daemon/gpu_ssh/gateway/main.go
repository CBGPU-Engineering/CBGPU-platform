package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/crypto/ssh"
)

const (
	defaultListenAddress = "127.0.0.1:22220"
	gpuAddress           = "100.100.136.37"
	authorizationTimeout = 22 * time.Second
)

type reservation struct {
	UserID    string    `json:"user_id"`
	GPUID     int       `json:"gpu_id"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
}

type registeredKey struct {
	UserID    string `json:"user_id"`
	PublicKey string `json:"public_key"`
}

type authorizer struct {
	baseURL string
	key     string
	client  *http.Client
}

var gatewayConnectionSequence atomic.Uint64

func (a *authorizer) fetch(ctx context.Context, path string, query url.Values, output any) error {
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		requestCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
		retry, err := a.fetchOnce(requestCtx, path, query, output)
		cancel()
		if err == nil || !retry || ctx.Err() != nil {
			return err
		}
		lastErr = err
		if attempt == 3 {
			break
		}
		log.Printf("%s lookup attempt %d failed; retrying: %v", path, attempt, err)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(attempt) * 200 * time.Millisecond):
		}
	}
	return lastErr
}

func (a *authorizer) fetchOnce(ctx context.Context, path string, query url.Values, output any) (bool, error) {
	u, err := url.Parse(a.baseURL + "/rest/v1/" + path)
	if err != nil {
		return false, err
	}
	u.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("apikey", a.key)
	req.Header.Set("Authorization", "Bearer "+a.key)
	res, err := a.client.Do(req)
	if err != nil {
		return true, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return res.StatusCode == http.StatusTooManyRequests || res.StatusCode >= 500, fmt.Errorf("%s returned %d", path, res.StatusCode)
	}
	return false, json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(output)
}

// allowed checks the live reservation and registered key on every connection.
// Any database error denies access. An overlapping booking with two owners also denies access.
func (a *authorizer) allowed(ctx context.Context, key ssh.PublicKey, now time.Time) (map[int]time.Time, error) {
	var bookings []reservation
	q := url.Values{
		"select":     {"user_id,gpu_id,start_time,end_time"},
		"status":     {"eq.approved"},
		"start_time": {"lte." + now.UTC().Format(time.RFC3339Nano)},
		"end_time":   {"gt." + now.UTC().Format(time.RFC3339Nano)},
	}
	if err := a.fetch(ctx, "reservations", q, &bookings); err != nil {
		return nil, err
	}
	if len(bookings) == 0 {
		return nil, nil
	}
	var keys []registeredKey
	if err := a.fetch(ctx, "gpu_ssh_keys", url.Values{"select": {"user_id,public_key"}}, &keys); err != nil {
		return nil, err
	}
	owners := make(map[int]string)
	ends := make(map[int]time.Time)
	conflict := make(map[int]bool)
	for _, r := range bookings {
		if r.GPUID < 1 || r.GPUID > 4 || r.UserID == "" || now.Before(r.StartTime) || !now.Before(r.EndTime) {
			continue
		}
		if owner, exists := owners[r.GPUID]; exists && owner != r.UserID {
			conflict[r.GPUID] = true
		}
		owners[r.GPUID] = r.UserID
		if ends[r.GPUID].IsZero() || r.EndTime.Before(ends[r.GPUID]) {
			ends[r.GPUID] = r.EndTime
		}
	}
	matchedUsers := make(map[string]bool)
	for _, row := range keys {
		parsed, _, options, _, err := ssh.ParseAuthorizedKey([]byte(row.PublicKey))
		if err == nil && len(options) == 0 && parsed.Type() == ssh.KeyAlgoED25519 && bytes.Equal(parsed.Marshal(), key.Marshal()) {
			matchedUsers[row.UserID] = true
		}
	}
	allowed := make(map[int]time.Time)
	for gpu, owner := range owners {
		if !conflict[gpu] && matchedUsers[owner] {
			allowed[gpu] = ends[gpu]
		}
	}
	return allowed, nil
}

type forwardRequest struct {
	Destination string
	Port        uint32
	Origin      string
	OriginPort  uint32
}

func handleForward(ch ssh.NewChannel, pub ssh.PublicKey, auth *authorizer, backendAddress func(int) string, connectionID, forwardID uint64) {
	started := time.Now()
	var target forwardRequest
	if err := ssh.Unmarshal(ch.ExtraData(), &target); err != nil || target.Destination != gpuAddress || target.Port < 2201 || target.Port > 2204 {
		log.Printf("conn=%d forward=%d rejected: invalid GPU destination %q:%d", connectionID, forwardID, target.Destination, target.Port)
		ch.Reject(ssh.Prohibited, "GPU destination only")
		return
	}
	gpu := int(target.Port - 2200)
	log.Printf("conn=%d forward=%d GPU #%d requested", connectionID, forwardID, gpu)
	ctx, cancel := context.WithTimeout(context.Background(), authorizationTimeout)
	allowed, err := auth.allowed(ctx, pub, time.Now())
	cancel()
	end, ok := allowed[gpu]
	if err != nil || !ok {
		log.Printf("conn=%d forward=%d authorization denied after %s", connectionID, forwardID, time.Since(started))
		if err != nil {
			log.Printf("conn=%d forward=%d GPU #%d denied: reservation lookup: %v", connectionID, forwardID, gpu, err)
		} else {
			log.Printf("conn=%d forward=%d GPU #%d denied: no active reservation for SSH key", connectionID, forwardID, gpu)
		}
		ch.Reject(ssh.Prohibited, "No active reservation")
		return
	}
	log.Printf("conn=%d forward=%d authorized after %s", connectionID, forwardID, time.Since(started))
	backend, err := net.DialTimeout("tcp", backendAddress(gpu), 5*time.Second)
	if err != nil {
		log.Printf("conn=%d forward=%d GPU #%d failed: backend connection: %v", connectionID, forwardID, gpu, err)
		ch.Reject(ssh.ConnectionFailed, "GPU unavailable")
		return
	}
	log.Printf("conn=%d forward=%d backend connected after %s", connectionID, forwardID, time.Since(started))
	client, requests, err := ch.Accept()
	if err != nil {
		log.Printf("conn=%d forward=%d GPU #%d failed: channel accept: %v", connectionID, forwardID, gpu, err)
		backend.Close()
		return
	}
	log.Printf("GPU #%d forward opened", gpu)
	go ssh.DiscardRequests(requests)
	var once sync.Once
	done := make(chan struct{})
	closeBoth := func() { once.Do(func() { client.Close(); backend.Close(); close(done) }) }
	defer func() {
		closeBoth()
		log.Printf("conn=%d forward=%d GPU #%d closed after %s", connectionID, forwardID, gpu, time.Since(started))
	}()
	copyDone := make(chan struct{}, 2)
	go func() {
		n, copyErr := io.Copy(backend, client)
		log.Printf("conn=%d forward=%d GPU #%d client-to-backend finished: bytes=%d error=%v", connectionID, forwardID, gpu, n, copyErr)
		if tcp, ok := backend.(*net.TCPConn); ok {
			tcp.CloseWrite()
		}
		if copyErr != nil {
			closeBoth()
		}
		copyDone <- struct{}{}
	}()
	go func() {
		n, copyErr := io.Copy(client, backend)
		log.Printf("conn=%d forward=%d GPU #%d backend-to-client finished: bytes=%d error=%v", connectionID, forwardID, gpu, n, copyErr)
		client.CloseWrite()
		if copyErr != nil {
			closeBoth()
		}
		copyDone <- struct{}{}
	}()
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	deadline := time.NewTimer(time.Until(end))
	defer deadline.Stop()
	completed := 0
	for {
		select {
		case <-deadline.C:
			log.Printf("conn=%d forward=%d GPU #%d closed: reservation deadline reached", connectionID, forwardID, gpu)
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), authorizationTimeout)
			allowed, err := auth.allowed(ctx, pub, time.Now())
			cancel()
			newEnd := allowed[gpu]
			if err != nil || newEnd.IsZero() || !time.Now().Before(newEnd) {
				log.Printf("conn=%d forward=%d GPU #%d closed: reservation no longer valid, lookup error=%v", connectionID, forwardID, gpu, err)
				return
			}
			if newEnd.Before(end) {
				end = newEnd
				if !deadline.Stop() {
					select {
					case <-deadline.C:
					default:
					}
				}
				deadline.Reset(time.Until(end))
			}
		case <-done:
			return
		case <-copyDone:
			completed++
			if completed == 2 {
				return
			}
		}
	}
}

func serveConnection(conn net.Conn, config *ssh.ServerConfig, auth *authorizer, backendAddress func(int) string) {
	connectionID := gatewayConnectionSequence.Add(1)
	started := time.Now()
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(30 * time.Second))
	server, channels, requests, err := ssh.NewServerConn(conn, config)
	if err != nil {
		log.Printf("conn=%d gateway SSH handshake failed after %s: %v", connectionID, time.Since(started), err)
		return
	}
	log.Printf("conn=%d gateway SSH authenticated after %s", connectionID, time.Since(started))
	conn.SetDeadline(time.Time{})
	defer server.Close()
	go ssh.DiscardRequests(requests)
	pub, _, _, _, err := ssh.ParseAuthorizedKey([]byte(server.Permissions.Extensions["public_key"]))
	if err != nil {
		return
	}
	var forwardID uint64
	for channel := range channels {
		if channel.ChannelType() != "direct-tcpip" {
			log.Printf("conn=%d gateway channel rejected: %s", connectionID, channel.ChannelType())
			channel.Reject(ssh.Prohibited, "Forwarding only")
			continue
		}
		forwardID++
		go handleForward(channel, pub, auth, backendAddress, connectionID, forwardID)
	}
	log.Printf("conn=%d gateway SSH connection closed after %s", connectionID, time.Since(started))
}

func main() {
	listenAddress := os.Getenv("CBGPU_GATEWAY_LISTEN_ADDRESS")
	if listenAddress == "" {
		listenAddress = defaultListenAddress
	}
	secretPath := os.Getenv("CBGPU_SERVICE_ROLE_KEY_FILE")
	hostKeyPath := os.Getenv("CBGPU_GATEWAY_HOST_KEY")
	baseURL := strings.TrimRight(os.Getenv("CBGPU_SUPABASE_URL"), "/")
	if secretPath == "" || hostKeyPath == "" || baseURL == "" {
		log.Fatal("CBGPU_SERVICE_ROLE_KEY_FILE, CBGPU_GATEWAY_HOST_KEY and CBGPU_SUPABASE_URL are required")
	}
	secret, err := os.ReadFile(secretPath)
	if err != nil || strings.TrimSpace(string(secret)) == "" {
		log.Fatal("Cannot read service role key")
	}
	hostKey, err := os.ReadFile(hostKeyPath)
	if err != nil {
		log.Fatal("Cannot read SSH host key: ", err)
	}
	signer, err := ssh.ParsePrivateKey(hostKey)
	if err != nil {
		log.Fatal("Invalid SSH host key: ", err)
	}
	auth := &authorizer{baseURL: baseURL, key: strings.TrimSpace(string(secret)), client: &http.Client{Timeout: 6 * time.Second}}
	config := &ssh.ServerConfig{MaxAuthTries: 3, PublicKeyCallback: func(conn ssh.ConnMetadata, pub ssh.PublicKey) (*ssh.Permissions, error) {
		if conn.User() != "gateway" || pub.Type() != ssh.KeyAlgoED25519 {
			log.Print("gateway authentication denied: unsupported user or key type")
			return nil, errors.New("denied")
		}
		ctx, cancel := context.WithTimeout(context.Background(), authorizationTimeout)
		defer cancel()
		allowed, err := auth.allowed(ctx, pub, time.Now())
		if err != nil {
			log.Printf("gateway authentication denied: reservation lookup: %v", err)
			return nil, errors.New("denied")
		}
		if len(allowed) == 0 {
			log.Print("gateway authentication denied: no active reservation for SSH key")
			return nil, errors.New("denied")
		}
		return &ssh.Permissions{Extensions: map[string]string{"public_key": string(ssh.MarshalAuthorizedKey(pub))}}, nil
	}}
	config.AddHostKey(signer)
	listener, err := net.Listen("tcp", listenAddress)
	if err != nil {
		log.Fatal(err)
	}
	defer listener.Close()
	log.Print("GPU SSH gateway listening on ", listenAddress)
	capacity := make(chan struct{}, 64)
	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Print("Accept failed: ", err)
			continue
		}
		select {
		case capacity <- struct{}{}:
			go func() {
				defer func() { <-capacity }()
				serveConnection(conn, config, auth, func(gpu int) string {
					return net.JoinHostPort(gpuAddress, strconv.Itoa(2200+gpu))
				})
			}()
		default:
			conn.Close()
		}
	}
}
