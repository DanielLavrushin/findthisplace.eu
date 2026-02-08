#!/bin/bash
set -e

BINARY_PATH="/var/www/findthisplace.eu/findthisplace"
SERVICE_NAME="findthisplace.service"
DOWNLOAD_URL="https://github.com/DanielLavrushin/findthisplace.eu/releases/latest/download/findthisplace"
LOG_TAG="findthisplace-update"

log() { logger -t "$LOG_TAG" "$1"; echo "$1"; }

# wait for the HTTP response to complete before restarting
sleep 2

log "downloading new binary..."
wget -q -O "${BINARY_PATH}.new" "$DOWNLOAD_URL"
chmod +x "${BINARY_PATH}.new"

log "stopping service..."
sudo systemctl stop "$SERVICE_NAME"

mv "${BINARY_PATH}.new" "$BINARY_PATH"

log "starting service..."
sudo systemctl start "$SERVICE_NAME"

log "update complete"
