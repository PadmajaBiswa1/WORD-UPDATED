#!/usr/bin/env bash
set -e

MINIDOCK="/home/vinay/minidock/target/release/minidock"
DIR="/home/vinay/WORD-UPDATED"

if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run with sudo: sudo ./run-minidock.sh"
  exit 1
fi

echo "[+] Stopping any previously running containers..."
for cid in $($MINIDOCK ps 2>/dev/null | awk 'NR>1 {print $1}'); do
  $MINIDOCK stop "$cid" >/dev/null 2>&1 || true
done

echo "[+] Starting EtherX Word Backend in minidock..."
BE_ID=$($MINIDOCK run -d \
  --image "$DIR/backend-rootfs.tar.gz" \
  --hostname word-backend \
  -- /bin/sh -c "cd /app && PORT=5053 NODE_ENV=production node server.js")
echo "    Backend Container ID: $BE_ID"

echo "[+] Starting EtherX Word Frontend in minidock..."
FE_ID=$($MINIDOCK run -d \
  --image "$DIR/frontend-rootfs.tar.gz" \
  --hostname word-frontend \
  -- /usr/sbin/nginx -g "daemon off;")
echo "    Frontend Container ID: $FE_ID"

echo "[+] Starting Cloudflare Tunnel in minidock..."
CF_ID=$($MINIDOCK run -d \
  --image "$DIR/cloudflared-rootfs.tar.gz" \
  --hostname word-tunnel \
  -- /usr/local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000)
echo "    Tunnel Container ID:  $CF_ID"

echo ""
echo "=== Active minidock Containers ==="
$MINIDOCK ps

echo ""
echo "[+] Waiting for Cloudflare Tunnel URL..."
for i in {1..35}; do
  URL=$($MINIDOCK logs "$CF_ID" 2>&1 | grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' | grep -v 'api\.trycloudflare\.com' | head -n 1 || true)
  if [ -n "$URL" ]; then
    echo ""
    echo "=========================================================="
    echo "  Public Tunnel URL:"
    echo "  $URL"
    echo "=========================================================="
    break
  fi
  sleep 1
done

echo ""
echo "[+] To view logs:"
echo "    sudo $MINIDOCK logs $BE_ID"
echo "    sudo $MINIDOCK logs $FE_ID"
echo "    sudo $MINIDOCK logs $CF_ID"
echo ""
echo "[+] To stop containers:"
echo "    sudo $MINIDOCK stop $BE_ID"
echo "    sudo $MINIDOCK stop $FE_ID"
echo "    sudo $MINIDOCK stop $CF_ID"
