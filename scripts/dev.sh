#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

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

wait_for_file() {
  file_path=$1
  dependent_pid=$2

  while [ ! -f "$file_path" ]; do
    if ! kill -0 "$dependent_pid" 2>/dev/null; then
      wait "$dependent_pid"
      return $?
    fi
    sleep 1
  done
}

trap cleanup INT TERM EXIT

cd "$ROOT_DIR"

npm run dev --prefix server &
SERVER_PID=$!

wait_for_file "$ROOT_DIR/rest-api/index.js" "$SERVER_PID"

npm run dev --prefix client &
CLIENT_PID=$!

wait_for_first_exit "$SERVER_PID" "$CLIENT_PID"
