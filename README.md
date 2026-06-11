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

### Type checking

```bash
bun run type-check
```

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Done | Project foundation, monorepo, shared types |
| 2 | ⏳ Next | Auth — master password, AES-256, sessions |
| 3 | — | Encrypted config store, server/project CRUD |
| 4 | — | Deploy engine — SSH, SSE log streaming |
| 5 | — | Inbound webhooks (GitHub Actions trigger) |
| 6 | — | Env file manager |
| 7 | — | Docker image manager |
| 8 | — | Reverse proxy manager (Caddy + Nginx) |
| 9 | — | Notifications (email + outbound webhooks) |
| 10 | — | Security hardening + self-host deployment |
| 11 | — | AI security scanner |

## Security

- All credentials encrypted at rest (AES-256-GCM)
- Master password never stored — PBKDF2-derived key held in memory only
- SSH private keys never stored — path references only, read at runtime
- Env file contents never persisted locally — fetched live, pushed back, discarded
- Sessions via httpOnly + Secure + SameSite=Strict cookies
- Rate limiting on auth endpoint (5 attempts → 15min lockout)
- HTTPS enforced via Caddy when self-hosted (Phase 10)
