#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$ROOT_DIR/.env"
SERVER_BABEL_NODE="$ROOT_DIR/server/node_modules/.bin/babel-node"
NODE_VERSION_FILE="$ROOT_DIR/.nvmrc"

if [ -f "$NODE_VERSION_FILE" ]; then
  NODE_VERSION=$(tr -d '[:space:]' < "$NODE_VERSION_FILE")
  NVM_NODE_BIN="$HOME/.nvm/versions/node/v$NODE_VERSION/bin"

  if [ -n "$NODE_VERSION" ] && [ -x "$NVM_NODE_BIN/node" ]; then
    PATH="$NVM_NODE_BIN:$PATH"
    export PATH
  fi
fi

resolve_repo_path() {
  value=$1

  if [ -z "$value" ]; then
    return 0
  fi

  node -e '
    const path = require("path");
    const rootDir = process.argv[1];
    const input = process.argv[2];
    const expanded = input.startsWith("~/")
      ? path.join(process.env.HOME || "", input.slice(2))
      : input;
    console.log(path.resolve(rootDir, expanded));
  ' "$ROOT_DIR" "$value"
}

if [ ! -f "$ENV_FILE" ]; then
  printf '%s\n' \
    "Error: $ENV_FILE not found. Create the repo root .env before running npm run metadata:sync:full." \
    >&2
  exit 1
fi

if [ ! -f "$SERVER_BABEL_NODE" ]; then
  printf '%s\n' \
    "Error: server dependencies are not installed. Run npm install before running npm run metadata:sync:full." \
    >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

DATABASE_PATH=${DATABASE_PATH:-}
ASSETS_PATH=${ASSETS_PATH:-}
LOGS_PATH=${LOGS_PATH:-}

if [ -n "$DATABASE_PATH" ]; then
  DATABASE_PATH=$(resolve_repo_path "$DATABASE_PATH")
  export DATABASE_PATH
fi

if [ -n "$ASSETS_PATH" ]; then
  ASSETS_PATH=$(resolve_repo_path "$ASSETS_PATH")
  export ASSETS_PATH
fi

if [ -n "$LOGS_PATH" ]; then
  LOGS_PATH=$(resolve_repo_path "$LOGS_PATH")
  export LOGS_PATH
fi

cd "$ROOT_DIR"

npm run metadata:sync:full --prefix server
