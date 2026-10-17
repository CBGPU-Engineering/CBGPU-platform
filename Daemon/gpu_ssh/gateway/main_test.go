package main

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"
)

func testKey(t *testing.T) ssh.PublicKey {
	t.Helper()
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	key, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func TestAllowedRequiresLiveBookingAndMatchingKey(t *testing.T) {
	now := time.Date(2026, 10, 17, 1, 0, 0, 0, time.UTC)
	key := testKey(t)
	keyText := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(key)))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("apikey") != "test-secret" || r.Header.Get("Authorization") != "Bearer test-secret" {
			t.Errorf("missing service authentication")
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		switch r.URL.Path {
		case "/rest/v1/reservations":
			if r.URL.Query().Get("status") != "eq.approved" {
				t.Errorf("approved status not filtered")
			}
			fmt.Fprintf(w, `[{"user_id":"user-a","gpu_id":1,"start_time":"%s","end_time":"%s"},`+
				`{"user_id":"user-b","gpu_id":2,"start_time":"%s","end_time":"%s"}]`,
				now.Add(-time.Minute).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339),
				now.Add(-time.Minute).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339))
		case "/rest/v1/gpu_ssh_keys":
			fmt.Fprintf(w, `[{"user_id":"user-a","public_key":%q}]`, keyText)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	a := &authorizer{baseURL: server.URL, key: "test-secret", client: server.Client()}
	allowed, err := a.allowed(context.Background(), key, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(allowed) != 1 || allowed[1].IsZero() {
		t.Fatalf("unexpected allowed GPUs: %v", allowed)
	}
	other, err := a.allowed(context.Background(), testKey(t), now)
	if err != nil || len(other) != 0 {
		t.Fatalf("unregistered key was allowed: %v, %v", other, err)
	}
	expired, err := a.allowed(context.Background(), key, now.Add(2*time.Minute))
	if err != nil || len(expired) != 0 {
		t.Fatalf("expired booking was allowed: %v, %v", expired, err)
	}
}

func TestAllowedFailsClosedOnOverlappingOwnersAndDatabaseError(t *testing.T) {
	now := time.Now().UTC()
	key := testKey(t)
	keyText := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(key)))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/v1/reservations" {
			fmt.Fprintf(w, `[{"user_id":"user-a","gpu_id":3,"start_time":"%s","end_time":"%s"},`+
				`{"user_id":"user-b","gpu_id":3,"start_time":"%s","end_time":"%s"}]`,
				now.Add(-time.Minute).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339),
				now.Add(-time.Minute).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339))
			return
		}
		fmt.Fprintf(w, `[{"user_id":"user-a","public_key":%q}]`, keyText)
	}))
	a := &authorizer{baseURL: server.URL, key: "test-secret", client: server.Client()}
	allowed, err := a.allowed(context.Background(), key, now)
	if err != nil || len(allowed) != 0 {
		t.Fatalf("conflicting booking was allowed: %v, %v", allowed, err)
	}
	server.Close()
	if _, err := a.allowed(context.Background(), key, now); err == nil {
		t.Fatal("database failure did not deny access")
	}
}

func TestSSHForwardsOnlyBookedGPU(t *testing.T) {
	pub, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := ssh.NewSignerFromKey(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	backend, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer backend.Close()
	go func() {
		conn, err := backend.Accept()
		if err == nil {
			defer conn.Close()
			io.Copy(conn, conn)
		}
	}()
	key, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatal(err)
	}
	keyText := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(key)))
	var revoked atomic.Bool
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/v1/reservations" {
			if revoked.Load() {
				fmt.Fprint(w, "[]")
				return
			}
			fmt.Fprintf(w, `[{"user_id":"user-a","gpu_id":4,"start_time":"%s","end_time":"%s"}]`,
				time.Now().Add(-time.Minute).UTC().Format(time.RFC3339), time.Now().Add(time.Minute).UTC().Format(time.RFC3339))
			return
		}
		fmt.Fprintf(w, `[{"user_id":"user-a","public_key":%q}]`, keyText)
	}))
	defer api.Close()
	auth := &authorizer{baseURL: api.URL, key: "test-secret", client: api.Client()}
	_, hostPrivate, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	hostSigner, err := ssh.NewSignerFromKey(hostPrivate)
	if err != nil {
		t.Fatal(err)
	}
	config := &ssh.ServerConfig{PublicKeyCallback: func(meta ssh.ConnMetadata, offered ssh.PublicKey) (*ssh.Permissions, error) {
		allowed, err := auth.allowed(context.Background(), offered, time.Now())
		if err != nil || len(allowed) == 0 {
			return nil, fmt.Errorf("denied")
		}
		return &ssh.Permissions{Extensions: map[string]string{"public_key": string(ssh.MarshalAuthorizedKey(offered))}}, nil
	}}
	config.AddHostKey(hostSigner)
	gateway, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer gateway.Close()
	go func() {
		serverConn, err := gateway.Accept()
		if err == nil {
			serveConnection(serverConn, config, auth, func(int) string { return backend.Addr().String() })
		}
	}()
	clientPipe, err := net.DialTimeout("tcp", gateway.Addr().String(), 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	clientConn, channels, requests, err := ssh.NewClientConn(clientPipe, "gateway", &ssh.ClientConfig{
		User: "gateway", Auth: []ssh.AuthMethod{ssh.PublicKeys(signer)}, HostKeyCallback: ssh.InsecureIgnoreHostKey(), Timeout: 5 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	client := ssh.NewClient(clientConn, channels, requests)
	defer client.Close()
	if _, err := client.NewSession(); err == nil {
		t.Fatal("shell session was accepted")
	}
	if _, err := client.Dial("tcp", "100.100.136.37:2203"); err == nil {
		t.Fatal("unbooked GPU was forwarded")
	}
	conn, err := client.Dial("tcp", "100.100.136.37:2204")
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if _, err := conn.Write([]byte("gpu-ready")); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, len("gpu-ready"))
	if _, err := io.ReadFull(conn, buf); err != nil || string(buf) != "gpu-ready" {
		t.Fatalf("forwarded data = %q, %v", buf, err)
	}
	revoked.Store(true)
	closed := make(chan error, 1)
	go func() {
		_, err := conn.Read(make([]byte, 1))
		closed <- err
	}()
	select {
	case err := <-closed:
		if err == nil {
			t.Fatal("revoked connection returned data instead of closing")
		}
	case <-time.After(22 * time.Second):
		t.Fatal("revoked connection was not closed within one poll interval")
	}
}
