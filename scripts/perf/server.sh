#!/usr/bin/env bash
# Start, stop or restart a production-mode server for perf runs on its own port
# (default 3100), serving the current client/dist. Spotify sync is always off.
# Restarting resets the in-memory rate limiters.
#
#   scripts/perf/server.sh start|stop|restart|status
#
# PERF_PORT overrides the port. The server reads DB_URI etc. from the repo's
# .env like `bun run start` does; nothing here writes to the database.
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT="${PERF_PORT:-3100}"
DIR="scripts/perf/results"
PIDFILE="$DIR/server-$PORT.pid"
LOG="$DIR/server-$PORT.log"
mkdir -p "$DIR"

running() { [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

start() {
  if running; then echo "already running (pid $(cat "$PIDFILE"))"; return; fi
  if [[ ! -f client/dist/index.html ]]; then echo "client/dist missing: run bun run build first" >&2; exit 1; fi
  PORT="$PORT" NODE_ENV=production SKIP_SPOTIFY_SYNC=true nohup node server/index.js >>"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  for _ in $(seq 1 50); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/health" 2>/dev/null || curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
      echo "perf server up on http://127.0.0.1:$PORT (pid $(cat "$PIDFILE"))"; return
    fi
    sleep 0.2
  done
  echo "server did not come up; see $LOG" >&2; exit 1
}

stop() {
  if running; then kill "$(cat "$PIDFILE")"; sleep 0.5; echo "stopped"; else echo "not running"; fi
  rm -f "$PIDFILE"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) if running; then echo "running (pid $(cat "$PIDFILE"))"; else echo "not running"; fi ;;
  *) echo "usage: $0 start|stop|restart|status" >&2; exit 2 ;;
esac
