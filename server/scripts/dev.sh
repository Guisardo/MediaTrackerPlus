#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SERVER_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SERVER_DIR/.." && pwd)

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT_DIR/.env"
  set +a
fi

cleanup() {
  trap - INT TERM EXIT
  kill 0 2>/dev/null || true
}

wait_for_first_exit() {
  while true; do
    for pid in "$@"; do
      if ! kill -0 "$pid" 2>/dev/null; then
        wait "$pid"
        return $?
      fi
    done
    sleep 1
  done
}

trap cleanup INT TERM EXIT

cd "$SERVER_DIR"

npm run lingui:compile
npm run build:routes
npm run build:server

npm run watch:routes &
ROUTES_PID=$!

npm run watch:build:server &
BUILD_PID=$!

npm run watch:start &
START_PID=$!

wait_for_first_exit "$ROUTES_PID" "$BUILD_PID" "$START_PID"
