#!/usr/bin/env bash
# Creates the runtime role shop_app (password from .shop_app.pw) and grants it DML only.
# Tables belong to the owner role velmren, which runs the migrations; default privileges cover
# tables added by later migrations. Safe to run again. The password goes through stdin only.
set -euo pipefail
APP_DIR=${APP_DIR:-/srv/velmren/apps/electronics-store}
DB=${DB:-electronics}
psql_owner() { docker compose -f "$APP_DIR/compose.yaml" exec -T postgres psql -v ON_ERROR_STOP=1 -q -U velmren -d "$DB" "$@"; }
if [ "$(psql_owner -Atc "select count(*) from pg_roles where rolname='shop_app'")" = 0 ]; then
  printf "CREATE ROLE shop_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '%s';\n" "$(cat "$APP_DIR/.shop_app.pw")" | psql_owner
fi
psql_owner <<EOF
GRANT CONNECT ON DATABASE "$DB" TO shop_app;
GRANT USAGE ON SCHEMA public TO shop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shop_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO shop_app;
ALTER DEFAULT PRIVILEGES FOR ROLE velmren IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shop_app;
ALTER DEFAULT PRIVILEGES FOR ROLE velmren IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO shop_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
EOF
echo "shop_app ready in $DB"
