#!/bin/sh

set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
HOME="${HOME:-/home/mediatracker}"
export HOME

if [ "${HOSTNAME:-}" = "$(hostname)" ]; then
  HOSTNAME="0.0.0.0"
  export HOSTNAME
fi

case "$PUID" in
  ''|*[!0-9]*)
    echo "PUID must be numeric, received: $PUID" >&2
    exit 1
    ;;
esac

case "$PGID" in
  ''|*[!0-9]*)
    echo "PGID must be numeric, received: $PGID" >&2
    exit 1
    ;;
esac

mkdir -p /storage /assets /logs "$HOME"

echo
echo "PUID: $PUID"
echo "PGID: $PGID"
echo

chown -R "$PUID:$PGID" /storage
chown -R "$PUID:$PGID" /assets
chown -R "$PUID:$PGID" /logs
chown -R "$PUID:$PGID" "$HOME"

exec su-exec "$PUID:$PGID" node /app/build/index.js
