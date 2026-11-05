# Launchpad

Self-hosted VPS deploy dashboard. One-click deploys, live log streaming, env management, Docker image control, reverse proxy editing, and email + webhook notifications — all from a secure web UI.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16.2 (App Router, Turbopack) |
| API | ElysiaJS on Bun |
| SSH | node-ssh |
| Encryption | AES-256-GCM + PBKDF2 (Node crypto) |
| Database | lowdb (encrypted JSON) |
| Email | Nodemailer + ZeptoMail + React Email |
| Monorepo | Bun workspaces + Turborepo |

## Monorepo Structure

```
launchpad/
├── apps/
│   ├── web/        # Next.js 16.2 UI
│   └── server/     # ElysiaJS API (Bun)
└── packages/
    └── shared/     # Shared TypeScript types
```

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) >= 1.3

### Install

```bash
bun install
```

### Development

```bash
# Run both apps in parallel
bun dev

# Or individually
cd apps/server && bun dev
cd apps/web    && bun dev
```

### Environment

```bash
# Server
cp apps/server/.env.example apps/server/.env

# Web
cp apps/web/.env.example apps/web/.env.local
```

### Production deployment

Deployment artifacts: [apps/server/Dockerfile](apps/server/Dockerfile), [apps/web/Dockerfile](apps/web/Dockerfile), [docker-compose.yml](docker-compose.yml), [Caddyfile](Caddyfile).

1. Point a DNS record for your Launchpad domain at the host.
2. Create a root `.env` for Docker Compose:

   ```bash
   DOMAIN=launchpad.example.com
   ACME_EMAIL=ops@example.com
   SESSION_SECRET=<output of: openssl rand -hex 32>
   # Optional: directory holding SSH private keys (default ./ssh)
   SSH_KEYS_DIR=./ssh
   ```

3. Put the private keys for the servers you manage in `./ssh` (it is git- and docker-ignored). They are mounted read-only into the API container at `/app/ssh`, so in the UI use paths like `/app/ssh/id_ed25519`. Encrypted keys are supported: enter the key passphrase on the server form (it is stored encrypted, and “Test connection” checks it before saving).
4. Build and start:

   ```bash
   docker compose up -d --build
   ```

5. Create the master password. A fresh install prints a one-time setup code to the API log; the setup page asks for it, so nobody else can claim the instance before you do. The code changes on every restart.

   ```bash
   docker compose logs server | grep "Setup code"
   ```

Notes:

- Caddy terminates HTTPS and proxies to the Next.js app; Next rewrites `/api/*` to the internal Elysia service. The API address is baked in at build time (`NEXT_PUBLIC_API_URL` build arg).
- Data persists in `./data/launchpad.db.json`. Optizen backs it up daily to `./data/backups` (keeps 14 by default; change it, back up now, download, upload and restore under Settings → Backups). Copy that folder off the server too. Secrets in a backup stay encrypted, so you also need the master password. A backup has the same format as the data file, so if the dashboard won't start you can stop the stack and copy one over `./data/launchpad.db.json`. Set `BACKUP_DIR` to use another folder.
- The encryption key lives only in memory. After the API container restarts, sign in once before webhook-triggered deploys can run (they return 503 until then).
- Security: the API refuses to start in production without a strong `SESSION_SECRET` (32+ characters) and an `https://` `WEB_URL`. The master password is hashed with scrypt (older SHA-256 hashes upgrade on the next sign-in). Failed sign-ins lock out the offending IP for 15 minutes after 5 tries, not the whole instance. Caddy adds HSTS, nosniff, no-framing and referrer headers. Only Caddy publishes ports; the web and API containers are reachable only on the internal Docker network.
- Deploy webhooks are public at `https://<DOMAIN>/api/webhooks/deploy/<projectId>/<secret>`.

### Public landing site on its own domain

The landing page and docs (`/`, `/about`, `/contribute`, `/help/*`) can be served on a public domain while the dashboard lives on a different one:

1. Point DNS for both domains at the host and add to `.env`:

   ```bash
   DOMAIN=ops-x7k.example.com     # dashboard: pick a name that is not easy to guess
   PUBLIC_DOMAIN=example.com      # public landing page + docs
   ```

2. Start with the override file:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.public-site.yml up -d --build
   ```

On `PUBLIC_DOMAIN` the dashboard, sign-in, setup and API do not exist (404; `/login` and `/setup` redirect to the install guide at `/help/install`). There is no sign-in link on the public site; that spot and the landing page's main buttons say "Get it on GitHub", and the install guide opens with the same prompt, since Optizen is self-hosted with no accounts. On `DOMAIN`, `/` goes straight to the dashboard. Without `PUBLIC_DOMAIN`, one domain serves everything as before.

### Type checking

```bash
bun run type-check
```

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Done | Project foundation, monorepo, shared types |
| 2 | ✅ Done | Auth — master password, AES-256, sessions |
| 3 | ✅ Done | Encrypted config store, server/project CRUD |
| 4 | ✅ Done | Deploy engine — SSH, SSE log streaming |
| 5 | ✅ Done | Inbound webhooks (GitHub Actions trigger) |
| 6 | ✅ Done | Env file manager |
| 7 | ✅ Done | Docker image manager |
| 8 | ✅ Done | Reverse proxy manager (Caddy + Nginx) |
| 9 | ✅ Done | Notifications (email + outbound webhooks) |
| 10 | ✅ Done | Security hardening + self-host deployment |
| 10.1 | ✅ Done | SSH key passphrases, memory inspector (top processes, containers, free-up actions) |
| 11 | — | AI security scanner |

## Security

- All credentials encrypted at rest (AES-256-GCM)
- Master password never stored — PBKDF2-derived key held in memory only
- SSH private keys never stored — path references only, read at runtime
- Env file contents never persisted locally — fetched live, pushed back, discarded
- Sessions via httpOnly + Secure + SameSite=Strict cookies
- Rate limiting on auth endpoint (5 attempts → 15min lockout)
- HTTPS enforced via Caddy when self-hosted (Phase 10)
