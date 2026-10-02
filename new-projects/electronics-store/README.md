# VELMREN tech

Electronics store with a catalogue, cart, checkout, customer accounts, support and an admin panel. Next.js, PostgreSQL and S3-compatible image storage (MinIO locally, Cloudflare R2 on the live site).

Live version: https://shop.velmren.com

Catalogue, users, carts, orders, reviews and support tickets are stored in PostgreSQL; staff image uploads go to S3-compatible storage. Payment and delivery providers run only in test mode: no money is charged and nothing is shipped. Prices, stock, promo codes and the initial orders are sample data.

The catalogue has 60 models in 10 categories, including 25 smartphones, with 261 active colour and storage variants and 23 retired ones. Each supported colour has its own photos and gallery. The store also uses one interactive 3D model and one video made from photos.

## Getting started

Prerequisites: Node.js 24, npm, Docker with Docker Compose. Run the commands from this directory. Compose starts only PostgreSQL and MinIO; the app runs as a local Node.js process.

```sh
npm ci
cp .env.example .env
```

In `.env`, replace every `change-me-*` value and set `BETTER_AUTH_SECRET` to a random string of at least 32 characters, for example the output of:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Start the services and prepare the database:

```sh
npm run infra:up
docker compose ps        # wait until PostgreSQL is healthy
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev              # http://localhost:3210
```

Use the same host name for the site and `BETTER_AUTH_URL`, otherwise sessions are not kept.

Production build:

```sh
npm run build
npm start
```

`npm run infra:down` stops the services and keeps the named volumes with users, orders and uploads.

### Local services

| Service | Address | Purpose |
| --- | --- | --- |
| Next.js | `http://localhost:3210` | Storefront, account, admin and API |
| PostgreSQL 16 | `127.0.0.1:55435` (container `5432`) | Database `electronics`, user `velmren` |
| MinIO S3 | `http://localhost:59020` (container `9000`) | Image upload and delivery |
| MinIO Console | `http://localhost:59021` (container `9001`) | Storage console |

Container ports are bound to localhost. The Compose project is `velmren-electronics` with the volumes `postgres_data` and `minio_data`. With `S3_CREATE_BUCKET=true` the seed script creates the `electronics-media` bucket and makes its objects publicly readable; only the app server writes.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `POSTGRES_PASSWORD` | Database connection and container password; the passwords must match |
| `BETTER_AUTH_SECRET` | Server-side auth secret |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | Base URL of the app, locally `http://localhost:3210` |
| `TEST_MODE=true` | Allows the demo seed and test payment and delivery events |
| `DEMO_PASSWORD` | Password of the demo users created by the seed |
| `S3_ENDPOINT` | S3 endpoint the server writes to |
| `S3_PUBLIC_URL` | Public base URL of the bucket: uploads are served at `<S3_PUBLIC_URL>/<key>` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | S3 credentials |
| `S3_BUCKET`, `S3_REGION` | Image bucket and S3 client region (`auto` for R2) |
| `S3_CREATE_BUCKET` | `true` only for local MinIO: the seed creates the bucket and opens it for reading |

Setting `TEST_MODE=false` does not connect real payment or delivery providers.

### Demo data

`npm run db:seed` creates a customer `buyer@velmren.local` and an administrator `admin@velmren.local`, both with the password from `DEMO_PASSWORD`. Set it before the first seed: running the seed again does not change the password of existing users.

The seed also adds a customer address, three orders in different states, a bonus balance of 2500 and the promo codes `WELCOME10` (10%, up to 5000 RUB, from 1000 RUB) and `TECH2000` (2000 RUB off from 20 000 RUB). Running it again updates product descriptions and variants but keeps current stock.

`data/showcase-reviews.json` holds 12 sample reviews for 9 models. They are marked `isDemo` and shown only with `TEST_MODE=true`; `npx tsx scripts/seed-showcase-reviews.ts` loads them. Storefront ratings are calculated from published reviews and ignore other demo reviews.

## Things to try

1. On the home page, copy a promo code, open the catalogue, filter and sort, search for a model, add products to comparison and favourites.
2. On a product page, choose colour and storage, check stock and add the variant to the cart. iPhone 15 Pro Max has a 3D view, iPhone 13 Pro a video gallery.
3. Change quantities, apply a promo code and check out as a guest or signed in, with courier or pickup delivery. After a guest order, register in the same browser with the order email: the order moves to the account.
4. Pay by card or SBP from the order page through the test provider. Staff move orders through the delivery states in the admin panel; cash on delivery is recorded when the order is delivered.
5. In the account, edit the profile and addresses, repeat or cancel an order before shipping, and open a support ticket.
6. Sign in as the administrator at `/admin` and manage the catalogue, variants, prices, stock, promo codes, orders, review moderation and support replies.

## Architecture

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Motion 13 and Lucide. API routes in Next.js with Zod validation, Prisma 7 on PostgreSQL through `@prisma/adapter-pg`.
- Auth: Better Auth with email and password, cookie sessions and server-side roles `CUSTOMER`, `STAFF` and `ADMIN`. Passwords need at least 10 characters.
- Orders: guest checkout, server-side prices, a snapshot of the purchased items, atomic stock reservation, an idempotency key on checkout, status events and protection against processing a payment twice. Guest access is confirmed by a cookie; the order stores only a hash of the token. Cancelling returns stock and used bonuses; a paid order gets a test refund.
- Discounts and delivery: promo codes are checked on the server; bonuses can cover at most 30% of the total after the promo code. Courier delivery costs 490 RUB and is free from 30 000 RUB; pickup is free.
- Storage: business data and signed-in users' favourites in PostgreSQL; guest favourites, comparison and recently viewed items in local storage. The guest cart lives on the server under a cookie and merges into the user's cart after sign-in.
- Media: catalogue images are in `public/`, staff uploads in S3-compatible storage (Cloudflare R2 on the live site, served from its own domain). JPEG, PNG and WebP up to 5 MB, checked by file signature.
- `src/server/providers.ts` defines `PaymentProvider` and `ShippingProvider`. Real providers, signed webhooks, fiscal receipts and real delivery rates are not connected.

```
src/app/                  pages and API routes
src/components/           storefront, product pages and shared components
src/components/commerce/  account and admin interface
src/server/               auth, catalogue, orders, permissions, storage and providers
src/lib/                  API client and shared types
prisma/                   PostgreSQL schema and migrations
scripts/                  seed and catalogue scripts
data/catalog.json         catalogue source data
public/                   product images, video and 3D model
tests/server/             server integration tests
tests/e2e/                Playwright scenarios
deploy/                   production Dockerfile, Compose file, Caddy site, env and role scripts, backup units (deploy/README.md)
docs/                     API contract, screen map and media sources
```

## Tests

```sh
npm run typecheck
npm test                 # server tests in tests/server
npm run test:e2e         # Playwright, against a running site on port 3210
```

The server tests need the local database on port 55435, MinIO on 59020 and `TEST_MODE=true`. The Playwright tests need Chromium (`npx playwright install chromium`). Both write to the database, so use the project's own local services. Report and artefact paths are set in `playwright.config.ts`.

## Limits

Card and SBP payments, refunds, tracking and pickup are test transitions on the server. Newsletter and notification settings are saved, but no email or SMS provider is connected. Seller details, terms, specifications, warranties, prices and stock would need confirmation before real sales.

Photos of real devices are not covered by a free commercial licence. Sources, authors, changes and restrictions for every image, video and 3D model are listed in [docs/IMAGE-SOURCES.md](docs/IMAGE-SOURCES.md), brand logos in [docs/BRAND-SOURCES.md](docs/BRAND-SOURCES.md).

## Documentation

- [docs/FUNCTION-MAP.md](docs/FUNCTION-MAP.md): the 11 main customer screens with routes, data and scenarios
- [docs/API.md](docs/API.md): API contract
- [docs/IMAGE-SOURCES.md](docs/IMAGE-SOURCES.md): image, video and 3D sources
- [docs/BRAND-SOURCES.md](docs/BRAND-SOURCES.md): brand logo sources
