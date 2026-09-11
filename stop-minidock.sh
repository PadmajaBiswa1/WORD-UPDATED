#!/usr/bin/env bash
MINIDOCK="/home/vinay/minidock/target/release/minidock"

if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run with sudo: sudo ./stop-minidock.sh"
  exit 1
fi

echo "[+] Stopping all running minidock containers..."
# Stop via minidock stop using full UUIDs from state directory
for state_dir in "/root/.minidock/state" "$HOME/.minidock/state"; do
  if [ -d "$state_dir" ]; then
    for f in "$state_dir"/*.json; do
      [ -e "$f" ] || continue
      id=$(basename "$f" .json)
      echo "  Stopping container $id..."
      $MINIDOCK stop "$id" >/dev/null 2>&1 || true
    done
  fi
done

# Terminate any remaining minidock container processes
pkill -9 -f '/bin/sh -c cd /app && PORT=5053' 2>/dev/null || true
pkill -9 -f 'node server.js' 2>/dev/null || true
pkill -9 -f '/usr/sbin/nginx -g daemon off;' 2>/dev/null || true
pkill -9 -f 'cloudflared tunnel' 2>/dev/null || true
pkill -9 -f 'minidock run' 2>/dev/null || true

echo "[+] All containers and processes stopped."
