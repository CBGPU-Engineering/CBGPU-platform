#!/bin/bash

# CBGPU Network Toggle Script
# Usage: cbgpu-network [internal|external|status]

PORTS="8001 8002 8003 8004 3000"
INTERNAL_NET="10.138.26.0/24"

case "$1" in
    external)
        echo "Enabling External Access..."
        for port in $PORTS; do
            sudo ufw allow $port/tcp > /dev/null
        done
        echo "[OK] Ports $PORTS are now open to Anywhere."
        ;;
    internal)
        echo "Restricting to Internal Network ($INTERNAL_NET)..."
        for port in $PORTS; do
            sudo ufw delete allow $port/tcp > /dev/null 2>&1
            sudo ufw allow from $INTERNAL_NET to any port $port proto tcp > /dev/null
        done
        echo "[OK] Ports $PORTS are now restricted to $INTERNAL_NET."
        ;;
    status)
        echo "Current Firewall Status for CBGPU Ports:"
        sudo ufw status | grep -E "8001|8002|8003|8004|3000"
        ;;
    *)
        echo "Usage: $0 {internal|external|status}"
        exit 1
        ;;
esac
