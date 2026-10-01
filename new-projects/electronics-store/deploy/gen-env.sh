#!/usr/bin/env bash
# Creates the server .env and admin-credentials with fresh random secrets.
# Prints variable names only; never overwrites existing files.
set -euo pipefail
APP_DIR=${APP_DIR:-/srv/velmren/apps/electronics-store}
PUBLIC_URL=${PUBLIC_URL:-https://shop.velmren.com}
env_file=$APP_DIR/.env
admin_file=$APP_DIR/admin-credentials
for f in "$env_file" "$admin_file"; do
  [ -e "$f" ] && { echo "exists: $f, not overwritten" >&2; exit 1; }
done
rnd() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
umask 077
pg=$(rnd 24)
cat > "$env_file" <<EOF
POSTGRES_PASSWORD=$pg
DATABASE_URL=postgresql://velmren:$pg@postgres:5432/electronics
BETTER_AUTH_SECRET=$(rnd 32)
BETTER_AUTH_URL=$PUBLIC_URL
NEXT_PUBLIC_APP_URL=$PUBLIC_URL
TEST_MODE=true
DEMO_PASSWORD=Vb-$(rnd 10)
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_URL=$PUBLIC_URL
S3_ACCESS_KEY=shop-$(rnd 6)
S3_SECRET_KEY=$(rnd 24)
S3_BUCKET=electronics-media
S3_REGION=us-east-1
EOF
cat > "$admin_file" <<EOF
ADMIN_EMAIL=admin@velmren.local
ADMIN_PASSWORD=Va-$(rnd 12)
EOF
chmod 600 "$env_file" "$admin_file"
cut -d= -f1 "$env_file" "$admin_file"
