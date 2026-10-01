#!/usr/bin/env bash
# Store backups: "db" writes a PostgreSQL dump, "minio" archives uploaded media.
# Run by the electronics-store-backup@ systemd units; keeps the newest KEEP_* files.
set -euo pipefail
APP_DIR=${APP_DIR:-/srv/velmren/apps/electronics-store}
DATA_DIR=${DATA_DIR:-/srv/velmren/data/electronics-store}
BACKUP_DIR=${BACKUP_DIR:-/srv/velmren/backups/electronics-store}
KEEP_DB=${KEEP_DB:-7}
KEEP_MINIO=${KEEP_MINIO:-4}
case "${1:-}" in db|minio) ;; *) echo "usage: $0 db|minio" >&2; exit 2 ;; esac
ts=$(date -u +%Y%m%dT%H%M%SZ)
tmp=
trap '[ -n "$tmp" ] && rm -f -- "$tmp"' EXIT
umask 077
mkdir -p -- "$BACKUP_DIR"
prune() { ls -1t -- "$BACKUP_DIR"/$1 2>/dev/null | tail -n +$(($2 + 1)) | xargs -r rm -f --; }
case "$1" in
  db)
    tmp=$BACKUP_DIR/.db-$ts.dump.part
    docker compose -f "$APP_DIR/compose.yaml" exec -T postgres pg_dump -U velmren -d electronics -Fc > "$tmp"
    [ "$(head -c 5 "$tmp")" = PGDMP ] || { echo "dump is not a PostgreSQL archive" >&2; exit 1; }
    mv -- "$tmp" "$BACKUP_DIR/db-$ts.dump"
    prune 'db-*.dump' "$KEEP_DB"
    ;;
  minio)
    tmp=$BACKUP_DIR/.minio-$ts.tar.gz.part
    # Exit code 1 only reports files changed while reading; the archive is still written.
    tar -C "$DATA_DIR" --warning=no-file-changed -czf "$tmp" minio || [ $? -eq 1 ]
    mv -- "$tmp" "$BACKUP_DIR/minio-$ts.tar.gz"
    prune 'minio-*.tar.gz' "$KEEP_MINIO"
    ;;
esac
echo "backup $1 written: $(ls -1t -- "$BACKUP_DIR" | head -n 1)"
