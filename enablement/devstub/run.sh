#!/usr/bin/env bash
# Start the DDIL dev stub (stand-in backend) on 127.0.0.1 and print the matching Vite command.
#   ./run.sh            foreground, Ctrl-C stops it
#   ./run.sh --bg       background; log in stub.log, pid in .stub.pid
#   ./run.sh --stop     stop a background stub
# Env: DEVSTUB_PORT (default 8000; if busy, the first free port in 8010-8019), DEVSTUB_PACE (agent delay multiplier, default 1)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PIDFILE="$HERE/.stub.pid"
LOG="$HERE/stub.log"

if [[ "${1:-}" == "--stop" ]]; then
  if [[ -f "$PIDFILE" ]] && kill "$(cat "$PIDFILE")" 2>/dev/null; then echo "devstub stopped (pid $(cat "$PIDFILE"))"; else echo "no running devstub"; fi
  rm -f "$PIDFILE"; exit 0
fi

command -v node >/dev/null || { echo "node not found (Node 22 or later required)"; exit 1; }
busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
PORT="${DEVSTUB_PORT:-8000}"
if busy "$PORT"; then
  if [[ -n "${DEVSTUB_PORT:-}" ]]; then echo "port $PORT is in use"; exit 1; fi
  echo "port $PORT is in use by another process; looking for a free port in 8010-8019"
  for p in $(seq 8010 8019); do if ! busy "$p"; then PORT=$p; break; fi; done
  busy "$PORT" && { echo "no free port in 8010-8019"; exit 1; }
fi

cat <<EOF
Frontend (separate terminal):
  cd "$REPO/demo/frontend"
  API_URL=http://127.0.0.1:$PORT WS_URL=ws://127.0.0.1:$PORT ./node_modules/.bin/vite --port 5180 --strictPort --host 127.0.0.1
Then open http://127.0.0.1:5180
EOF

if [[ "${1:-}" == "--bg" ]]; then
  nohup node "$HERE/server.mjs" --port "$PORT" >"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  sleep 1
  head -5 "$LOG"
  echo "devstub running in background (pid $(cat "$PIDFILE"), log $LOG)"
else
  exec node "$HERE/server.mjs" --port "$PORT"
fi
