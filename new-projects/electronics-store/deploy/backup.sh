#!/usr/bin/env bash
# Store backup: writes a PostgreSQL dump. Run by the electronics-store-backup@db systemd unit;
# keeps the newest KEEP_DB dumps. Uploaded images live in Cloudflare R2 and are not copied here.
set -euo pipefail
APP_DIR=${APP_DIR:-/srv/velmren/apps/electronics-store}
BACKUP_DIR=${BACKUP_DIR:-/srv/velmren/backups/electronics-store}
KEEP_DB=${KEEP_DB:-7}
case "${1:-}" in db) ;; *) echo "usage: $0 db" >&2; exit 2 ;; esac
ts=$(date -u +%Y%m%dT%H%M%SZ)
tmp=
trap '[ -n "$tmp" ] && rm -f -- "$tmp"' EXIT
umask 077
mkdir -p -- "$BACKUP_DIR"
prune() { ls -1t -- "$BACKUP_DIR"/$1 2>/dev/null | tail -n +$(($2 + 1)) | xargs -r rm -f --; }
tmp=$BACKUP_DIR/.db-$ts.dump.part
docker compose -f "$APP_DIR/compose.yaml" exec -T postgres pg_dump -U velmren -d electronics -Fc > "$tmp"
[ "$(head -c 5 "$tmp")" = PGDMP ] || { echo "dump is not a PostgreSQL archive" >&2; exit 1; }
mv -- "$tmp" "$BACKUP_DIR/db-$ts.dump"
prune 'db-*.dump' "$KEEP_DB"
echo "backup db written: db-$ts.dump"
