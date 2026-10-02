#!/usr/bin/env bash
# Creates the server env files with fresh random secrets. Prints variable names only and never
# overwrites existing files.
#   .env               compose interpolation: password of the PostgreSQL owner role velmren
#   app.env            what the app reads; DATABASE_URL uses the DML-only role shop_app
#   migrate.env        owner role for migrations, the demo seed and admin scripts (service "migrate")
#   .shop_app.pw       password of shop_app, used by app-role.sh
#   admin-credentials  administrator e-mail and password for set-admin-password.ts
# The Cloudflare R2 keys are not generated: put S3_ACCESS_KEY and S3_SECRET_KEY into app.env yourself.
set -euo pipefail
APP_DIR=${APP_DIR:-/srv/velmren/apps/electronics-store}
PUBLIC_URL=${PUBLIC_URL:-https://shop.velmren.com}
MEDIA_URL=${MEDIA_URL:-https://shop-media.velmren.com}
R2_ENDPOINT=${R2_ENDPOINT:?set R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com}
R2_BUCKET=${R2_BUCKET:-velmren-shop-media}
for f in .env app.env migrate.env .shop_app.pw admin-credentials; do
  [ -e "$APP_DIR/$f" ] && { echo "exists: $APP_DIR/$f, nothing written" >&2; exit 1; }
done
rnd() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
umask 077
pg=$(rnd 24)
app_pw=$(rnd 24)
auth=$(rnd 32)
printf 'POSTGRES_PASSWORD=%s\n' "$pg" > "$APP_DIR/.env"
printf '%s\n' "$app_pw" > "$APP_DIR/.shop_app.pw"
cat > "$APP_DIR/app.env" <<EOF
DATABASE_URL=postgresql://shop_app:$app_pw@postgres:5432/electronics
BETTER_AUTH_SECRET=$auth
BETTER_AUTH_URL=$PUBLIC_URL
TEST_MODE=true
S3_ENDPOINT=$R2_ENDPOINT
S3_PUBLIC_URL=$MEDIA_URL
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=$R2_BUCKET
S3_REGION=auto
EOF
cat > "$APP_DIR/migrate.env" <<EOF
DATABASE_URL=postgresql://velmren:$pg@postgres:5432/electronics
BETTER_AUTH_SECRET=$auth
BETTER_AUTH_URL=$PUBLIC_URL
TEST_MODE=true
DEMO_PASSWORD=Vb-$(rnd 10)
EOF
cat > "$APP_DIR/admin-credentials" <<EOF
ADMIN_EMAIL=admin@velmren.local
ADMIN_PASSWORD=Va-$(rnd 12)
EOF
chmod 600 "$APP_DIR/.env" "$APP_DIR/app.env" "$APP_DIR/migrate.env" "$APP_DIR/.shop_app.pw" "$APP_DIR/admin-credentials"
for f in .env app.env migrate.env admin-credentials; do echo "$f: $(cut -d= -f1 "$APP_DIR/$f" | tr '\n' ' ')"; done
echo "fill S3_ACCESS_KEY and S3_SECRET_KEY in app.env, then run app-role.sh after PostgreSQL starts"
