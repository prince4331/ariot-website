# syntax=docker/dockerfile:1
# =============================================================================
# ARIOT production image — multi-stage build for Docker Compose deployment.
#
# Targets (see compose.production.yml):
#   runtime  — final web image: Next.js standalone server, non-root, port 3000
#   migrate  — one-shot `prisma migrate deploy` image (Prisma CLI + migrations)
#   seed     — one-shot initial seed image (full source + content + CLI);
#              only ever run explicitly via `docker compose run`
#
# Build args:
#   NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_PLAUSIBLE_DOMAIN are compile-time
#   inlines for the client bundle. They are PUBLIC values — never pass secrets
#   as build args (secrets are injected at runtime via compose `environment:`).
#
# BuildKit is recommended (faster, layer caching) but NOT required: the
# Dockerfile avoids BuildKit-only syntax so it also builds with the classic
# builder (DOCKER_BUILDKIT=0) on hosts without the buildx plugin.
# =============================================================================

ARG NODE_VERSION=24.22.0

# ── base: pinned Node + pnpm via corepack ────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH="/pnpm:${PATH}" \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ── deps: install the full dependency tree from the lockfile ────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── build: generate Prisma Client + next build (standalone output) ──────────
FROM deps AS build
COPY . .
RUN pnpm exec prisma generate
ARG NEXT_PUBLIC_SITE_URL=https://ariottech.com
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN=""
# Build-time placeholders only. Several modules fail closed when they are
# imported during `next build` (admin route modules construct the Prisma
# client at import time; Better Auth refuses its default secret; the media
# provider selector requires an explicit provider in production). The values
# below contain no secret and are NOT baked into the runtime image — the
# runtime stage starts from a clean base and receives the real values from
# Compose at container start.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public \
    BETTER_AUTH_SECRET=build-time-placeholder-secret-not-used-at-runtime \
    BETTER_AUTH_URL=https://ariottech.com \
    MEDIA_STORAGE_PROVIDER=local \
    MEDIA_LOCAL_ROOT=/var/lib/ariot/media \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=${NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
RUN pnpm build

# ── migrate: minimal image that can run `prisma migrate deploy` ─────────────
FROM node:${NODE_VERSION}-bookworm-slim AS migrate
ENV PNPM_HOME=/pnpm \
    PATH="/pnpm:${PATH}" \
    NODE_ENV=production
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --prod keeps the image small (no devDependencies). The husky `prepare`
# script is disabled: git hooks are irrelevant in a container image.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts \
    && pnpm exec prisma --version
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ── seed: full source + content for the explicit one-time initial seed ──────
# Runs `prisma/seed.ts` (Prisma CLI `db execute`) against the compose network.
# Never runs automatically — see deploy/README.md.
FROM build AS seed
CMD ["node", "--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "prisma/seed.ts"]

# ── runtime: Next.js standalone server, non-root ────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# Static assets referenced from public/ (brand logos, seeded SVG covers).
COPY --from=build /app/public ./public
# Standalone output: minimal server.js + traced node_modules.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
# Liveness only — DB reachability is verified by the migrate service + app
# routes, not by the container health check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
