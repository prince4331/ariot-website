# ARIOT VPS Deployment Guide

> **Superseded.** The production deployment architecture is now
> **Docker Engine + Docker Compose + Caddy** (Next.js standalone image,
> PostgreSQL in a container, one-shot `prisma migrate deploy`, automatic
> HTTPS). The previous PM2 + host Nginx + Certbot guide was retired in D1 —
> do not follow it, and do not install PM2 or host Node on the production VPS.

**Canonical runbook:** [`deploy/README.md`](../deploy/README.md)

Supporting files:

| File | Purpose |
|---|---|
| `compose.production.yml` | Production stack: `web`, `db`, `migrate`, `caddy` (+ explicit `seed` profile) |
| `Dockerfile` | Multi-stage image build (runtime / migrate / seed targets) |
| `.dockerignore` | Keeps env files, tests, docs, and local artifacts out of the image |
| `.env.production.example` | Every environment variable the app actually reads (see `server/env.ts`) |
| `deploy/Caddyfile` | HTTPS reverse proxy; `www.ariottech.com` → `https://ariottech.com` |
