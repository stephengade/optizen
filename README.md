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

Notes:

- Caddy terminates HTTPS and proxies to the Next.js app; Next rewrites `/api/*` to the internal Elysia service. The API address is baked in at build time (`NEXT_PUBLIC_API_URL` build arg).
- Data persists in `./data/launchpad.db.json`. Back it up; without your master password it cannot be decrypted.
- The encryption key lives only in memory. After the API container restarts, sign in once before webhook-triggered deploys can run (they return 503 until then).
- Deploy webhooks are public at `https://<DOMAIN>/api/webhooks/deploy/<projectId>/<secret>`.

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
