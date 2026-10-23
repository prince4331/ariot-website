# ARIOT Production Deployment — OVH VPS + Docker Compose

Canonical runbook for `https://ariottech.com`. Stack: **Docker Engine + Docker
Compose** (`compose.production.yml`): `web` (Next.js standalone), `db`
(PostgreSQL 16), `migrate` (one-shot `prisma migrate deploy`), `caddy`
(automatic HTTPS). **No PM2, no host Node, no host Nginx.**

> **Never run `docker compose down -v`.** The `-v` flag deletes the PostgreSQL
> volume (all data). Use plain `docker compose ... down` only when needed;
> normal restarts/redeploys never require `down`.

## 0. Prerequisites

- OVH VPS: Ubuntu 24.04 LTS, ≥ 2 vCPU, **4 GB RAM**, 40 GB+ SSD
- A domain `ariottech.com` in a control panel you manage
- SSH access as a sudo user

## 1. OVH Ubuntu initial setup

```bash
apt update && apt upgrade -y
adduser deployer                      # or your preferred user
usermod -aG sudo deployer
ufw allow OpenSSH && ufw enable       # see §2
```

Add 2–4 GB swap (the image build needs headroom on a 4 GB box):

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Firewall ports

Only SSH, HTTP and HTTPS. **PostgreSQL (5432) is never opened** — the DB is
reachable only on the internal Compose network.

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp        # HTTP/3
ufw enable
```

## 3. Docker Engine + Compose

```bash
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
usermod -aG docker deployer           # re-login afterwards
docker compose version                # must print v2.x
```

## 4. DNS

In the DNS panel for `ariottech.com`:

| Type  | Name | Value           |
|-------|------|-----------------|
| A     | @    | `<VPS public IP>` |
| AAAA  | @    | `<VPS IPv6>` (if the VPS has one) |
| A/CNAME | www | same as @ (Caddy redirects www → apex) |
| A/CNAME | admin | same as @ — `admin.ariottech.com`, the admin dashboard host (D-082). Add it before the first `up`: Caddy provisions a cert per host, and a missing record makes that host's issuance retry (the apex keeps serving). |

Wait for propagation before §6 (Caddy fails to obtain certs otherwise).

## 5. Get the code + environment

```bash
git clone https://github.com/prince4331/ariot-website.git /srv/ariot
cd /srv/ariot
cp .env.production.example .env
chmod 600 .env
nano .env          # fill every CHANGE_ME; see the comments in the file
```

Secrets: `openssl rand -base64 32` for `POSTGRES_PASSWORD` and
`BETTER_AUTH_SECRET`. `.env` is gitignored — never commit it, never pass
secrets as Docker build args.

## 6. Persistent media directory

```bash
sudo install -d -o 1000 -g 1000 /var/lib/ariot/media
```

uid/gid 1000 = the `node` user inside the web container. The app creates
`tmp/` (in-progress uploads, never served) and `public/` (served media) under
this root. It survives redeploys and container recreation; nothing in the
deploy flow ever deletes it.

## 7. Build + first start

```bash
cd /srv/ariot
docker compose -f compose.production.yml up -d --build
```

Startup order (enforced by Compose): `db` healthy → `migrate` runs
`prisma migrate deploy` once and exits → `web` starts → `caddy` begins serving
HTTPS. Verify:

```bash
docker compose -f compose.production.yml ps     # all healthy / migrate exited 0
curl -fsS https://ariottech.com/api/health      # {"status":"ok"}
```

## 8. Database migrations

Migrations apply automatically on every `up` via the one-shot `migrate`
service using **`prisma migrate deploy`** (applies pending migrations only).
The seed and admin bootstrap NEVER run automatically.

- Do **not** use `prisma migrate reset` or `db push --force-reset` in
  production — they destroy data.
- A new release that ships migrations needs no extra step: `up` applies them.

## 9. Initial seed + admin bootstrap (explicit, one-time)

Only for a brand-new production database:

```bash
# Initial content (roles, placeholder catalog, 3 launch blog posts).
# Insert-only: reruns never overwrite admin-edited content (tests/seed-safety.test.ts).
docker compose -f compose.production.yml --profile initial run --rm seed

# SUPER_ADMIN user (dry-run first, then apply). Export the BOOTSTRAP_* vars
# in your shell — see .env.production.example § one-time operational values.
# The `seed` image contains the full source + scripts; DATABASE_URL is
# already wired to the db service in that profile.
docker compose -f compose.production.yml --profile initial run --rm \
  -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_CONFIRM \
  --entrypoint '' seed \
  node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  scripts/bootstrap-admin.ts --apply --production   # drop --apply for a dry-run
```The bootstrap script requires the `--production` flag for non-local DBs and is idempotent. Then sign in at `/sign-in` with Google (§10).

### 9.1 First-deploy ordering — seed before the first public request (I-034)

The marketing pages are **prerendered at image build time**, and the build has
no database — so the prerendered `/blog`, `/`, `/robotics`, `/research`, and
`/solutions` HTML contains the empty state. Seeding after the image is built
does NOT refresh those prerenders (the seed writes rows directly, bypassing
the Next cache). For a brand-new deploy, run in this order:

1. `up -d` (db → migrate → web) but do not advertise the site yet,
2. run the §9 seed (and admin bootstrap),
3. drop the stale prerenders by recreating the web container:

```bash
docker compose -f compose.production.yml up -d --force-recreate web
```

A plain `restart web` is **not** enough — the prerendered HTML lives in the
container's writable layer. After the first admin publish/edit, D-081's tag
invalidation keeps everything fresh automatically (verified live: 37/37
checks, 2026-10-23).

## 10. Google OAuth (admin sign-in)

Admin login lives on the admin subdomain (D-082 / D-083; I-036 resolved).
Better Auth derives the OAuth callback from `BETTER_AUTH_URL`, which must
therefore be the admin host — it is the compose default and the value in
`.env.production.example`.

In Google Cloud Console → OAuth client, confirm both are registered:

```
Authorized JavaScript origin: https://admin.ariottech.com
Authorized redirect URI:     https://admin.ariottech.com/api/auth/callback/google
```

Both are already present on the downloaded client (D2 structurally verified
it) — this is a confirmation step, not a change. The two settings are
coupled: if `BETTER_AUTH_URL` ever changes, the registered callback URI must
change with it.

Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env` (both or neither —
a single value fails boot validation), then `up -d` again.

Local development is unchanged (`http://localhost:3000`). No localhost
redirect URI is registered on the client, so Google sign-in cannot be
exercised locally unless one is added in the console (a deliberate
console-side decision — the codebase never changes the Google project).

**Live Google login is unverified** until a real HTTPS browser flow is
completed after deployment; D2 verified everything that is verifiable
without DNS/TLS (config, callback derivation, origin rejection).

## 11. Contact email (Resend)

Routing is environment-driven (D2 / D-083; I-031 reduced to configuration) —
no code edits or image rebuilds are needed to set addresses:

- `MAIL_FROM` — sender; MUST be on a domain verified with Resend
  (`"Display Name <no-reply@ariottech.com>"` or a bare address).
- `MAIL_TO` — owner-approved inbox receiving contact + quote notifications.
- `RESEND_API_KEY` — the Resend API key.

1. Verify `ariottech.com` in the Resend dashboard (DNS records).
2. Decide the real sender + inbox **with the owner** (do not invent them),
   put all three values in `.env`, then `up -d` (config change — no rebuild).
3. Test: submit the real contact form; expect success only after Resend
   accepts the send.

Failure posture: with `MAIL_FROM`/`MAIL_TO` unset in production, senders
fail CLOSED (`server/mail/routing.ts` throws at send time) and the forms
show an error — never a fake success; the web container also logs a non-PII
boot warning until both are set. Local development is unaffected (historical
placeholder fallbacks; sends stay stubbed without an API key).

## 12. Updating a release

```bash
cd /srv/ariot
git fetch --tags && git checkout <release-tag-or-main>
docker compose -f compose.production.yml build web      # reusable layer cache
docker compose -f compose.production.yml up -d          # migrate → rolling web restart
```

For clean rollback, tag images per release in `.env` (`IMAGE_TAG=<git-sha>`)
so the previous image stays on the host.

## 13. Backups (off-server)

```bash
# Database dump
docker compose -f compose.production.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /srv/backups/ariot-$(date +%F).sql.gz

# Media archive
tar czf /srv/backups/ariot-media-$(date +%F).tgz /var/lib/ariot/media
```

Ship both off-server (rclone to S3/R2, or `scp` to another host) and encrypt.
Test a restore into the `--profile initial` stack on a scratch VPS before
trusting the procedure. Retention: daily × 14, weekly × 8 is a reasonable
start.

## 14. Rollback

- **Code rollback** (app bug): `git checkout <previous-tag>` →
  `docker compose ... up -d --build`. Safe at any time; DB untouched.
- **Migration rollback**: NEVER automatic. Most migrations here are
  forward-only; reverting code while the DB is ahead is usually fine (read
  compatible). To roll back schema, restore the matching DB dump from §13 or
  write an explicit `down` migration — decide deliberately, never
  `migrate reset`.

## 15. Monitoring + logs

```bash
docker compose -f compose.production.yml ps            # health at a glance
docker compose -f compose.production.yml logs -f web   # app logs (10 MB × 3 rotated)
docker compose -f compose.production.yml logs --since 1h migrate
```

Host-level: `htop`, `df -h`, `docker system df`. Optional: add Uptime/Kuma or
UptimeRobot against `https://ariottech.com/api/health`. The `web` healthcheck
feeds Docker's restart policy — a crash-looping app is restarted
automatically; persistent failure = check logs + `migrate` output first.

## 16. Day-2 commands

```bash
docker compose -f compose.production.yml restart web        # app-only restart
docker compose -f compose.production.yml up -d              # reconcile to file state
docker compose -f compose.production.yml down               # stop stack (NO -v!)
docker compose -f compose.production.yml exec web sh        # shell in web container
```

Editorial note: blog posts published from `/admin/blog` appear immediately —
the admin mutation routes invalidate the tagged public reads
(`revalidateTag(PUBLIC_BLOG_TAG, { expire: 0 })`, D-081) before re-rendering
the pages — no rebuild or restart needed. Verified end-to-end in the local
Docker test stack on 2026-10-23 (37/37 checks: publish, edit, unpublish,
slug rename, draft privacy, reload stability). The admin dashboard is
published on `https://admin.ariottech.com` (same app container; auth config
lands in D2 — D-082/I-036).
