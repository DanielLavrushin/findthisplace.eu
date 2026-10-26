#!/bin/bash
# Dumps the findthisplace database into ~/findthisplace.backup and keeps a
# rotation: daily/ (last 7), weekly/ (8), monthly/ (12) and quarterly/ (all).
# A week, month or quarter keeps its first dump, so a night the Pi was off
# still leaves its period covered. Tiers hold hard links, so a dump takes its
# space once however many tiers keep it. latest.archive.gz points at the
# newest dump. Started by findthisplace-backup.timer as daniel; installed as
# /usr/local/bin/findthisplace-backup by `make deploy_units`. By hand, run it
# as daniel without sudo, or the dumps land in /root.
#
# Restore one, replacing the database's collections with the dump's:
#   docker exec -i findthisplace-mongodb sh -c 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" \
#     --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --drop' < FILE
set -euo pipefail

CONTAINER="${CONTAINER:-findthisplace-mongodb}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/findthisplace.backup}"
KEEP_DAILY=7
KEEP_WEEKLY=8
KEEP_MONTHLY=12
# a whole dump is ~10 MB; anything this small means the database came back
# (nearly) empty, and must not push good dumps out of the rotation
MIN_SIZE="${MIN_SIZE:-1000000}"

log() { echo "$1"; [ -n "${INVOCATION_ID:-}" ] || logger -t findthisplace-backup "$1"; }

# prune DIR N keeps the newest N dumps in DIR
prune() {
    find "$1" -maxdepth 1 -name 'findthisplace-*.archive.gz' -printf '%f\n' | sort -r | tail -n +"$(($2 + 1))" |
        while read -r f; do rm -f -- "$1/$f"; done
}

mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly,quarterly}
name="findthisplace-$(date +%F).archive.gz"
tmp="$BACKUP_DIR/daily/.$name.tmp"
trap 'rm -f "$tmp"' EXIT

log "dumping the findthisplace database..."
docker exec "$CONTAINER" sh -c 'mongodump --quiet --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
    --db findthisplace --archive --gzip' > "$tmp"
gzip -t "$tmp"
size=$(stat -c %s "$tmp")
if [ "$size" -lt "$MIN_SIZE" ]; then
    log "dump is only $size bytes, keeping the previous ones"
    exit 1
fi
mv -f "$tmp" "$BACKUP_DIR/daily/$name"

# promote TIER PERIOD links today's dump into TIER unless PERIOD has one
promote() {
    local target="$BACKUP_DIR/$1/findthisplace-$2.archive.gz"
    [ -e "$target" ] || ln "$BACKUP_DIR/daily/$name" "$target"
}
promote weekly "$(date +%G-W%V)"
promote monthly "$(date +%Y-%m)"
promote quarterly "$(date +%Y)-Q$((($(date +%-m) - 1) / 3 + 1))"

prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
prune "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"
ln -sfn "daily/$name" "$BACKUP_DIR/latest.archive.gz"

# the admin panel's grabber tab shows these
docker exec -e SIZE="$size" "$CONTAINER" sh -c 'mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin findthisplace --eval "
        db.ftp_settings.updateOne({_id: \"last_backup_time\"}, {\$set: {value: new Date()}}, {upsert: true});
        db.ftp_settings.updateOne({_id: \"last_backup_size\"}, {\$set: {value: NumberLong(process.env.SIZE)}}, {upsert: true});
    "' > /dev/null

log "saved $name ($((size / 1024)) KiB)"
