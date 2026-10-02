# Production deployment

The live store runs on one Debian server behind Cloudflare: Caddy terminates TLS, Docker Compose runs PostgreSQL and the app, uploaded images go to a Cloudflare R2 bucket with its own public domain. Commands run as root from `/srv/velmren/apps/electronics-store`.

## Layout

| Path | Purpose |
| --- | --- |
| `/srv/velmren/apps/electronics-store/compose.yaml` | `deploy/compose.yaml` |
| `.env` | `POSTGRES_PASSWORD` for compose interpolation (600) |
| `app.env` | variables the app reads: `DATABASE_URL` of `shop_app`, `BETTER_AUTH_*`, `TEST_MODE`, `S3_*` (600) |
| `migrate.env` | `DATABASE_URL` of the owner role `velmren` and the seed variables (600) |
| `.shop_app.pw`, `admin-credentials` | runtime role password and administrator login (600) |
| `releases/<version>/src` | unpacked source of each release |
| `/srv/velmren/data/electronics-store/postgres` | database files |
| `/srv/velmren/backups/electronics-store` | nightly `pg_dump` archives (`backup.sh`, systemd units in `systemd/`) |
| `/etc/caddy/sites/shop.caddy` | `deploy/shop.caddy`; needs `00-velmren-snippets.caddy` from `scripts/` |

`<version>` is the UTC time and the short commit, for example `20261002T210000Z-abc1234`. The running image is tagged `electronics-store:current`, the one before it `electronics-store:previous`.

Roles: the app connects as `shop_app` with SELECT, INSERT, UPDATE and DELETE only; migrations and admin scripts run as the owner `velmren` through the compose service `migrate`.

Images: bucket `velmren-shop-media`, S3 endpoint `https://<account id>.r2.cloudflarestorage.com`, region `auto`, an API token with Object Read & Write on this bucket only. Objects are public through the custom domain `https://shop-media.velmren.com` (`S3_PUBLIC_URL`); the bucket has no other public access.

## First install

1. Copy `compose.yaml`, `backup.sh`, `gen-env.sh` and `app-role.sh`. Run `R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com bash gen-env.sh` and write the R2 keys into `S3_ACCESS_KEY` and `S3_SECRET_KEY` of `app.env`.
2. Build the image (see Release, step 2) and tag it `electronics-store:current`.
3. `docker compose up -d postgres`, then `docker compose run --rm -T migrate` and `bash app-role.sh`.
4. Demo data and the administrator password:
   ```sh
   docker compose run --rm -T migrate node_modules/.bin/tsx scripts/seed.ts
   set -a; . ./admin-credentials; set +a
   docker compose run --rm -T -e ADMIN_EMAIL -e ADMIN_PASSWORD migrate node_modules/.bin/tsx deploy/set-admin-password.ts
   ```
5. `docker compose up -d app`, install `shop.caddy`, then `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy`.
6. Install `systemd/electronics-store-backup@.service` and `electronics-store-backup-db.timer`, enable the timer.

## Release

1. On a workstation: `git -c core.autocrlf=false archive --format=tar.gz -o <archive> HEAD:new-projects/electronics-store`, note its SHA-256 and copy it to the server.
2. Check the SHA-256, unpack into `releases/<version>/src`, then
   `docker build --pull -f releases/<version>/src/deploy/Dockerfile -t electronics-store:<version> releases/<version>/src`.
3. Fresh dump: `systemctl start electronics-store-backup@db.service`.
4. Switch: `docker tag electronics-store:current electronics-store:previous`, `docker tag electronics-store:<version> electronics-store:current`, `docker compose run --rm -T migrate`, `docker compose up -d app`.
5. Check the site from outside and keep a receipt: archive SHA-256, image id, checks and the rollback commands below.

Run `docker compose run` and `exec` with `-T` and `</dev/null` when they come from a script on stdin. Never use `docker compose down -v`.

## Rollback

- Code: `docker tag electronics-store:previous electronics-store:current && docker compose up -d --force-recreate app`.
- Schema: if a migration is not backward compatible, restore the dump taken in step 3 with `pg_restore -U velmren -d electronics --clean` inside the postgres container.
- Take the site down: remove `/etc/caddy/sites/shop.caddy`, validate, reload, `docker compose stop`.
