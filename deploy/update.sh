#!/bin/bash
# Installs a release binary and restarts the service. Started by
# findthisplace-update.path when the release webhook writes the trigger file
# (its payload carries the version), or by hand: sudo findthisplace-update [X.Y.Z]
# (default: latest). Installed as /usr/local/sbin/findthisplace-update by `make deploy_units`.
set -euo pipefail

BINARY_PATH="/var/www/findthisplace.eu/findthisplace"
SERVICE_NAME="findthisplace.service"
TRIGGER_FILE="/run/findthisplace-update/trigger"
RELEASES_URL="https://github.com/DanielLavrushin/findthisplace.eu/releases"
LOG_TAG="findthisplace-update"

# Under systemd stdout already lands in the journal; manual runs get logged there too
log() { echo "$1"; [ -n "${INVOCATION_ID:-}" ] || logger -t "$LOG_TAG" "$1"; }
fetch() { curl -fsSL --retry 5 --retry-delay 5 --retry-all-errors "$@"; }

VERSION="${1:-}"
if [ -z "$VERSION" ] && [ -f "$TRIGGER_FILE" ]; then
    VERSION=$(jq -r '.version // empty' "$TRIGGER_FILE" 2>/dev/null || true)
fi
rm -f "$TRIGGER_FILE"

if [ -z "$VERSION" ]; then
    BASE_URL="$RELEASES_URL/latest/download"
elif [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    BASE_URL="$RELEASES_URL/download/v$VERSION"
else
    log "refusing invalid version '$VERSION'"
    exit 1
fi

# The binary's directory is writable by the app user, so download and verify in a
# root-only temp dir, and use -T so a planted symlink is replaced, never written through
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

log "downloading ${VERSION:-latest} binary..."
fetch -o "$TMP_DIR/findthisplace" "$BASE_URL/findthisplace"
EXPECTED_MD5=$(fetch "$BASE_URL/findthisplace.md5" | cut -d' ' -f1)
ACTUAL_MD5=$(md5sum "$TMP_DIR/findthisplace" | cut -d' ' -f1)
if [ "$EXPECTED_MD5" != "$ACTUAL_MD5" ]; then
    log "checksum mismatch (expected $EXPECTED_MD5, got $ACTUAL_MD5), keeping the current binary"
    exit 1
fi

install -T -m 755 "$TMP_DIR/findthisplace" "${BINARY_PATH}.new"
mv -T -f "${BINARY_PATH}.new" "$BINARY_PATH"
log "restarting service..."
systemctl restart "$SERVICE_NAME"

log "update complete"
