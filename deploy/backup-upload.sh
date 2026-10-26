#!/bin/bash
# Copies the dumps in ~/findthisplace.backup to Google Drive, the only copy off
# the Pi's SD card, into My Drive/rclone/findthisplace.eu/mongo. daily/ and
# weekly/ are mirrored; monthly/ and quarterly/ are only added to, so Drive
# keeps every month after the Pi rotates it out. Started after each successful
# backup (OnSuccess= in findthisplace-backup.service) as daniel, whose
# ~/.config/rclone/rclone.conf has the gdrive remote with scope drive.file:
# rclone sees only what rclone made, so My Drive/rclone is its own area, and it
# makes the folders again if they are deleted. Installed as
# /usr/local/bin/findthisplace-backup-upload by `make deploy_units`.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/findthisplace.backup}"
REMOTE="${REMOTE:-gdrive:rclone/findthisplace.eu/mongo/}"

for tier in daily weekly; do
    rclone sync -v "$BACKUP_DIR/$tier" "$REMOTE$tier"
done
for tier in monthly quarterly; do
    rclone copy -v "$BACKUP_DIR/$tier" "$REMOTE$tier"
done
