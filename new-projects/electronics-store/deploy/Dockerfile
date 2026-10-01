# syntax=docker/dockerfile:1
# Build from the project root: docker build -f deploy/Dockerfile -t electronics-store:<version> .
FROM node:24-bookworm-slim AS base
# Prisma schema engine (migrate deploy) needs libssl; the slim image has none.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
# Build-time placeholders only; real values come from the runtime env file.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_URL=https://shop.velmren.com \
    BETTER_AUTH_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))") \
    npm run build \
 && ls node_modules/@prisma/engines | grep -q schema-engine-debian-openssl-3.0.x

# Dev dependencies stay in the image: prisma and tsx run migrations, seed and admin tasks.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app ./
RUN chown -R node:node .next
USER node
EXPOSE 3210
CMD ["node_modules/.bin/next", "start", "-p", "3210", "-H", "0.0.0.0"]
