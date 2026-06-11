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

Phase 10 now includes first-pass self-host deployment artifacts:

- [apps/server/Dockerfile](C:\Users\gade0x\Documents\xpx\peak\launchpad\apps\server\Dockerfile)
- [apps/web/Dockerfile](C:\Users\gade0x\Documents\xpx\peak\launchpad\apps\web\Dockerfile)
- [docker-compose.yml](C:\Users\gade0x\Documents\xpx\peak\launchpad\docker-compose.yml)
- [Caddyfile](C:\Users\gade0x\Documents\xpx\peak\launchpad\Caddyfile)

Create a root `.env` file for Docker Compose with:

```bash
DOMAIN=launchpad.example.com
ACME_EMAIL=ops@example.com
SESSION_SECRET=replace-with-a-long-random-secret
```

Then build and run:

```bash
docker compose build
docker compose up -d
```

Notes:

- Caddy terminates HTTPS and proxies public traffic to the Next.js app.
- The Next.js app rewrites `/api/*` to the internal Elysia service.
- Launchpad data persists in `./data/launchpad.db.json`.
- SSH key paths referenced in Launchpad still need to exist inside the running server container or be mounted in.

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
| 10 | ⏳ In Progress | Security hardening + self-host deployment |
| 11 | — | AI security scanner |

## Security

- All credentials encrypted at rest (AES-256-GCM)
- Master password never stored — PBKDF2-derived key held in memory only
- SSH private keys never stored — path references only, read at runtime
- Env file contents never persisted locally — fetched live, pushed back, discarded
- Sessions via httpOnly + Secure + SameSite=Strict cookies
- Rate limiting on auth endpoint (5 attempts → 15min lockout)
- HTTPS enforced via Caddy when self-hosted (Phase 10)
