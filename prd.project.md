**🚀
Launchpad**

Product Requirements Document

Version  **1.0**     Status
** In Development **     Stack
**Next.js 16 ·
ElysiaJS · Bun**

Phases
complete  **1 – 2 of 11**
Remaining  **Phases 3 – 11**

|  **What is Launchpad?** A
  self-hosted VPS deploy dashboard built for engineers who manage multiple
  servers and projects. One-click
  deploys with live SSH log streaming, env file management, Docker image
  control, reverse
  proxy editing (Caddy + Nginx), and email + webhook notifications — all
  secured behind AES-256-GCM

| encryption and a master password. |
| --------------------------------- |

# Table of Contents

# 1. Project Overview

## 1.1  Problem Statement

Deploying to a VPS via terminal is
repetitive and error-prone: SSH into server, navigate to project directory,
pull Docker image, restart containers, check logs — repeated for every project
on every server. There is no unified view, no deploy history, no easy rollback,
and no safety net if something goes wrong mid-deploy.

## 1.2  Solution

Launchpad is a self-hosted web
dashboard that centralises all VPS operations in one secure UI. It runs on the
developer's own infrastructure, encrypts all credentials at rest, and exposes a
clean interface for the most common deployment tasks.

## 1.3  Tech Stack

| **Layer**         | **Technology** | **Purpose** |
| ----------------------- | -------------------- | ----------------- |
| Frontend                | Next.js 16.2         |                   |
| (App Router, Turbopack) | UI — server +       |                   |
| client components       |                      |                   |
| API                     | ElysiaJS on          |                   |
| Bun                     | Typed REST           |                   |
| API + SSE streaming     |                      |                   |
| SSH                     | node-ssh             | Remote            |
| command execution       |                      |                   |
| Encryption              | Node crypto —       |                   |
| AES-256-GCM + PBKDF2    | Credential           |                   |
| protection at rest      |                      |                   |
| Database                | lowdb                |                   |
| (encrypted JSON)        | Local config         |                   |

+ deploy history      |
  |  Email       |  Nodemailer +
  ZeptoMail + React Email  |  Deploy
  notifications               |
  |  Monorepo    |  Bun
  workspaces + Turborepo            |  Multi-package
  build orchestration  |

## 1.4  Monorepo Structure

launchpad/

├── apps/

│   ├── web/          # Next.js 16.2 UI

│   └── server/       # ElysiaJS API (Bun)

└── packages/

    └── shared/       # Shared TypeScript types

## 1.5  Phase Status

| **Phase**           | **Name**    | **Status**  |
| ------------------------- | ----------------- | ----------------- |
| 1                         | Project           |                   |
| Foundation                | **✅ Done** |                   |
| 2                         | Auth              | **✅ Done** |
| 3                         | Encrypted         |                   |
| Config Store              | **⏳ Next** |                   |
| 4                         | Deploy Engine     | **—**      |
| 5                         | Inbound           |                   |
| Webhooks (GitHub Actions) | **—**      |                   |
| 6                         | Env File          |                   |
| Manager                   | **—**      |                   |
| 7                         | Docker Image      |                   |
| Manager                   | **—**      |                   |
| 8                         | Reverse Proxy     |                   |
| Manager                   | **—**      |                   |
| 9                         | Notifications     | **—**      |
| 10                        | Security          |                   |
| Hardening + Deployment    | **—**      |                   |
| 11                        | AI Security       |                   |
| Scanner                   | **—**      |                   |

# 2. Completed Phases (1 – 2)

## Phase 1 — Project Foundation

•
Bun workspaces + Turborepo
monorepo

•
Next.js 16.2.9 scaffolded
with App Router + Turbopack

•
ElysiaJS + Bun server
scaffolded

•
@launchpad/shared package —
all shared TS types (Server, Project, Deploy, Notifications, Auth)

•
Root tsconfig, turbo.json,
bunfig.toml, .gitignore

•
AES-256-GCM crypto lib
(fully implemented, key loaded into memory at login)

•
lowdb JSON store with
encrypted-field schema

•
node-ssh wrapper:
execCommand, execCommands, testConnection

•
Next.js lib/api.ts typed
fetch client + lib/utils.ts

•
Design tokens in
globals.css (dark terminal palette)

## Phase 2 — Auth

•
Master password setup flow
with PBKDF2 key derivation (310,000 iterations, SHA-256)

•
AES-256-GCM encryption key
held in memory only — never persisted

•
Signed session tokens
(HMAC-SHA256) in httpOnly cookies — 8hr TTL

•
Rate limiting: 5 failed
attempts → 15min lockout, persisted in DB

•
4 live-tested endpoints:
/auth/status, /auth/setup, /auth/login, /auth/logout

•
Auth middleware (Elysia
derive plugin) injects requireAuth() into all handler contexts

•
Setup page: password
strength bar, requirement checklist, confirm field

•
Login page: show/hide
toggle, remaining attempts messaging

•
AuthGate component:
redirects to /setup → /login → /dashboard based on state

•
Sidebar layout with icon
nav + logout button

# 3. Phase 3 — Encrypted Config Store

All server credentials and project
config stored in launchpad.db.json, with sensitive fields encrypted via the
AES-256-GCM layer from Phase 1. Every route must call requireAuth() as its
first statement.

## 3.1  API Routes  (apps/server/src/routes/)

| **File**                   | **Route**              | **Methods** | **Description** |
| -------------------------------- | ---------------------------- | ----------------- | --------------------- |
| servers.ts                       | /servers                     | GET, POST         | List all              |
| servers, create server           |                              |                   |                       |
| servers.ts                       | /servers/:id                 | GET, PATCH,       |                       |
| DELETE                           | Get, update,                 |                   |                       |
| delete server                    |                              |                   |                       |
| servers.ts                       | /servers/:id/test            | POST              | Test SSH              |
| connectivity → latency + status |                              |                   |                       |
| projects.ts                      | /servers/:id/projects        | GET, POST         | List projects         |
| for server, create project       |                              |                   |                       |
| projects.ts                      | /projects/:id                | GET, PATCH,       |                       |
| DELETE                           | Get, update,                 |                   |                       |
| delete project                   |                              |                   |                       |
| projects.ts                      | /projects/:id/webhook-secret | POST              | Regenerate            |
| webhook secret                   |                              |                   |                       |

## 3.2  Encryption Rules

•
Fields encrypted before DB
write: sshPassphrase, webhookSecret, smtp.password, outbound webhook secrets

•
Fields stored plaintext:
host, user, port, name, sshKeyPath, deployCommands, envPath

•
SSH private key content is
NEVER stored — sshKeyPath is a local filesystem path read at runtime

•
Encryption uses the
in-memory key loaded during login — all routes 401 if key not set

## 3.3  UI Pages  (apps/web/app/(dashboard)/)

| **Route**                                            | **File**        | **Description** |
| ---------------------------------------------------------- | --------------------- | --------------------- |
| /servers                                                   | servers/page.tsx      | Server grid —        |
| name, host, status badge, project count, add button        |                       |                       |
| /servers/[id]                                              | servers/[id]/page.tsx | Server detail         |
| — info, SSH test button, projects list                    |                       |                       |
| /servers/[id]/projects/[pid]                               | …/[pid]/page.tsx     | Project               |
| detail — deploy button, history, quick links to sub-pages |                       |                       |
| /settings                                                  | settings/page.tsx     | Global                |
| settings — SMTP config, global webhooks                   |                       |                       |

## 3.4  Components

•
ServerCard.tsx — status
badge (online/offline/unknown), host, user, project count, test connection

•
ServerForm.tsx —
create/edit modal: name, host, port, user, SSH key path, optional passphrase

•
ProjectCard.tsx — image
tag, last deploy status + time, quick-action buttons

•
ProjectForm.tsx —
create/edit modal: name, repo image, deploy commands (multi-line), env path,
proxy type, notification toggles

•
ConnectionBadge.tsx —
green/red/grey dot with latency ms

## 3.5  Data Shapes

Server create payload:

{ name, host, port, user,
sshKeyPath, sshPassphrase? }

Project create payload:

{ serverId, name,
repoImage, deployCommands[], envPath?, workingDir?,

  proxyType, webhookEnabled, notifications: {
onSuccess, onFailure, webhooks[] } }

# 4. Phase 4 — Deploy Engine

The core feature. Triggers SSH
commands on the VPS and streams stdout/stderr back to the browser in real time
via Server-Sent Events.

## 4.1  API Routes

| **Route**                        | **Method** | **Description** |
| -------------------------------------- | ---------------- | --------------------- |
| /deploy/:projectId                     | POST             | Trigger               |
| deploy — body: { imageTag?, trigger } |                  |                       |
| /deploy/:projectId/stream              | GET              | SSE stream —         |
| fires DeployLogEvent objects           |                  |                       |
| /deploy/:projectId/history             | GET              | Last 50               |
| deploy records for project             |                  |                       |
| /deploy/:projectId/history/:deployId   | GET              | Single deploy         |
| record + full log snapshot             |                  |                       |

## 4.2  SSE Event Shape

// DeployLogEvent (from
@launchpad/shared)

{ type:
"log",    line: "$ docker
pull ghcr.io/..." }

{ type:
"log",    line: "[stderr]
Warning: ..."   }

{ type:
"status", status: "deploying"             }

{ type:
"done",   status:
"success", durationMs: 4200 }

{ type:
"error",  error: "SSH
connection refused" }

## 4.3  Deploy Flow (Server)

Validate session + load
project + server from DB

Decrypt SSH passphrase if
present, open node-ssh connection

Emit { type:
"status", status: "deploying" }

Execute deployCommands[] in
sequence via execCommands(), streaming each line as { type: "log" }

On success: emit { type:
"done", status: "success", durationMs }

On failure: emit { type:
"error" } + { type: "done", status: "failed" }

Save DeployRecord to DB
(last 50 log lines snapshot)

Fire notification pipeline
(Phase 9 — stub in Phase 4)

## 4.4  UI Components

•
DeployButton.tsx — idle /
deploying spinner states, disabled during active deploy

•
LogStream.tsx —
terminal-style panel, JetBrains Mono, auto-scroll to bottom, timestamps per
line, green prompt prefix ($ ), stderr lines in yellow

•
DeployStatusBadge.tsx —
idle (grey) / deploying (blue pulse) / success (green) / failed (red)

•
DeployHistory.tsx — table
of past deploys: trigger icon, status, image tag, duration, timestamp

•
DeployDrawer.tsx — slide-in
panel housing LogStream + history tabs

# 5. Phase 5 — Inbound Webhooks (GitHub Actions)

Allows GitHub Actions (or any CI)
to trigger a deploy automatically after a successful build, without the user
touching the UI.

## 5.1  API Routes

| **Route**                         | **Method** | **Description** |
| --------------------------------------- | ---------------- | --------------------- |
| /webhooks/deploy/:projectId/:secret     | POST             | Trigger               |
| deploy — HMAC-verified inbound webhook |                  |                       |

## 5.2  Security

•
Each project has a unique
webhook secret (32-byte random hex, stored encrypted)

•
Secret is embedded in the
URL — no Authorization header needed for CI simplicity

•
Optional:
X-Hub-Signature-256 HMAC body verification for extra hardening

•
Endpoint is public (no
session cookie required) but secret-gated

•
Enable/disable toggle per
project — disabled = 404

•
Payload body: { imageTag?,
ref?, workflow? } — all optional

## 5.3  UI Elements

•
Webhook section in
ProjectForm: enable toggle, generated URL display, copy button, regenerate
secret button

•Auto-generated GitHub
Actions YAML snippet for copy-paste into .github/workflows/

- name: Deploy via
  Launchpad

  run: |

  curl -X POST ${{ secrets.LAUNCHPAD_URL
  }}/webhooks/deploy/\

  PROJECT_ID/SECRET \

  -H "Content-Type:
  application/json" \

  -d '{"imageTag":"${{
  github.sha }}"}'

## 5.4  triggeredBy Tracking

•
Deploy records store
trigger: "ui" | "github_actions" | "webhook"

•
Deploy history table shows
a trigger icon (mouse / GitHub logo / webhook)

# 6. Phase 6 — Env File Manager

|  **Security Constraint** Env file
  contents are NEVER persisted in Launchpad's database or any local file. Content
  is fetched live over SSH on demand, edited in memory, and pushed back over
  SSH. Once the

| editor closes, the content is gone from Launchpad's memory. |
| ----------------------------------------------------------- |

## 6.1  API Routes

| **Route**                               | **Method** | **Description** |
| --------------------------------------------- | ---------------- | --------------------- |
| /env/:projectId                               | GET              | Fetch .env            |
| file content over SSH — returns raw string   |                  |                       |
| /env/:projectId                               | PUT              | Push updated          |
| .env content back over SSH — overwrites file |                  |                       |

## 6.2  UI Components

•
EnvEditor.tsx — textarea
with syntax highlighting (KEY=VALUE pairs), line numbers

•
EnvDiff.tsx — side-by-side
or unified diff before saving, shows added/removed/changed lines

•
Save button disabled until
content differs from fetched version

•
Confirmation dialog before
pushing: "This will overwrite /var/www/app/.env on server-name"

•
Loading state while
fetching (SSH latency can be 200-500ms)

•
EnvPage auto-fetches on
mount, re-fetches on manual refresh

# 7. Phase 7 — Docker Image Manager

## 7.1  API Routes

| **Route**                                  | **Method** | **Description** |
| ------------------------------------------------ | ---------------- | --------------------- |
| /images/:projectId/status                        | GET              | Running               |
| container name, image tag, uptime, port mappings |                  |                       |
| /images/:projectId/pull                          | POST             | Pull specific         |
| image tag — body: { tag } (default:             |                  |                       |
| latest)                                          |                  |                       |
| /images/:projectId/rollback                      | POST             | Redeploy              |
| using a previous deploy record's image tag       |                  |                       |
| /images/:projectId/prune                         | POST             | Run docker            |
| image prune on server — returns freed space     |                  |                       |
| /images/:projectId/tags                          | GET              | List                  |
| available tags from GHCR or Docker Hub registry  |                  |                       |

## 7.2  Container Status Shape

{ containerId, name,
image, tag, status, uptime, ports[], restartCount }

## 7.3  UI Components

•
ImagePanel.tsx — current
image tag badge, container status, uptime, port list

•
TagSelector.tsx — dropdown
of available registry tags, with current tag highlighted

•
RollbackModal.tsx — list of
last 10 successful deploys with image tags, select to rollback

•
PruneButton.tsx —
confirmation dialog showing estimated space freed

•
Registry support: GHCR
(ghcr.io), Docker Hub (docker.io) — parsed from repoImage field

# 8. Phase 8 — Reverse Proxy Manager

## 8.1  API Routes

| **Route**                       | **Method** | **Description** |
| ------------------------------------- | ---------------- | --------------------- |
| /proxy/:serverId/detect               | GET              | Detect proxy          |
| type — returns "caddy"               | "nginx"          | "none"                |
| /proxy/:serverId/status               | GET              | Service               |
| running status + version              |                  |                       |
| /proxy/:serverId/config               | GET              | Fetch config          |
| file content over SSH                 |                  |                       |
| /proxy/:serverId/config               | PUT              | Push updated          |
| config + validate + reload            |                  |                       |
| /proxy/:serverId/reload               | POST             | Reload proxy          |
| without config change                 |                  |                       |
| /proxy/:serverId/sites                | GET              | Nginx only —         |
| list sites-available + enabled status |                  |                       |
| /proxy/:serverId/sites/:site/toggle   | POST             | Nginx only —         |
| enable or disable a site              |                  |                       |

## 8.2  Caddy specifics

•
Config file:
/etc/caddy/Caddyfile (default, configurable)

•
Validate via: caddy fmt
--overwrite && caddy reload

•
Reload command: systemctl
reload caddy

## 8.3  Nginx specifics

•
Sites directory:
/etc/nginx/sites-available/ (list all .conf files)

•
Enabled symlinks:
/etc/nginx/sites-enabled/

•
Validate via: nginx -t

•
Reload command: systemctl
reload nginx

## 8.4  UI Components

•
ProxyStatusBar.tsx — proxy
type badge, version, running/stopped status, reload button

•
ProxyEditor.tsx — config
textarea with syntax highlighting (Caddyfile / Nginx), validate-on-save

•
SitesList.tsx — Nginx only:
list of sites with enabled toggle per site

•
ValidationToast.tsx — shows
nginx -t output before saving

# 9. Phase 9 — Notifications

## 9.1  Email Stack

•
Transport: Nodemailer +
ZeptoMail SMTP

•
Templates: React Email —
rendered server-side via @react-email/render

•
Two templates:
DeploySuccess.tsx, DeployFailed.tsx

•
Template content: project
name, server name, trigger source, duration, log snapshot (last 20 lines),
timestamp, link to dashboard

•
SMTP config stored
encrypted in DB (smtp.password encrypted via crypto.ts)

## 9.2  API Routes

| **Route**             | **Method** | **Description** |
| --------------------------- | ---------------- | --------------------- |
| /notifications/test-email   | POST             | Send a test           |
| email to configured address |                  |                       |
| /notifications/webhooks     | GET, POST        | List / create         |
| global outbound webhooks    |                  |                       |
| /notifications/webhooks/:id | PATCH, DELETE    | Update /              |
| delete global webhook       |                  |                       |

## 9.3  Outbound Webhook Payload

{

  "event":       "deploy.success" |
"deploy.failed",

  "project":     { "id": "...",
"name": "my-app" },

  "server":      { "id": "...",
"name": "prod-1", "host": "1.2.3.4" },

  "triggeredBy": "ui" |
"github_actions" | "webhook",

  "timestamp":   "2026-01-01T00:00:00.000Z",

  "durationMs":  4200,

  "logSnapshot": "last 50 lines
of deploy output..."

}

## 9.4  Notification Logic

•
Notification pipeline
called at end of every deploy (Phase 4 stub, Phase 9 full implementation)

•
Per-project toggles:
onSuccess, onFailure, webhooks[]

•
Global webhooks fire on all
deploys regardless of per-project settings

•
Outbound webhooks: POST
with JSON body + X-Launchpad-Signature HMAC header if secret set

•
Email failures are logged
but do not affect deploy status

## 9.5  Settings UI

•
SMTP form: host, port,
secure toggle, user, password (masked), from, to (comma-separated)

•
Test email button — sends
test message immediately

•
Global webhooks table:
name, URL, events filter, secret (masked), enabled toggle

# 10. Phase 10 — Security Hardening + Deployment

## 10.1  Security Measures

| **Measure**                                                  | **Implementation** |
| ------------------------------------------------------------------ | ------------------------ |
| HTTPS                                                              | Caddy reverse            |
| proxy with automatic Let's Encrypt SSL — HTTP redirected to HTTPS |                          |
| Cookie flags                                                       | httpOnly +               |
| Secure + SameSite=Strict on all session cookies                    |                          |
| SSH keys                                                           | Scoped deploy            |
| keypairs generated per server — limited to deploy commands only   |                          |
| Webhook HMAC                                                       | X-Launchpad-Signature    |
| on outbound, secret in URL on inbound                              |                          |
| Rate limiting                                                      | Auth                     |
| endpoint: 5 attempts → 15min lockout (Phase 2 — already done)    |                          |
| TOTP 2FA                                                           | Stub in DB               |
| schema — full implementation deferred to Phase 11                 |                          |

## 10.2  Scoped Deploy SSH Keys

•
Launchpad generates a
dedicated Ed25519 keypair per server via ssh-keygen

•
Private key stored
encrypted in launchpad.db.json

•
Public key must be added to
~/.ssh/authorized_keys on the target VPS

•
Key has a command=
restriction limiting it to the deploy script only

•
UI: "Generate Deploy
Key" button per server — shows public key to copy

## 10.3  Docker Files

Dockerfile  (apps/server):

FROM oven/bun:1 AS builder

WORKDIR /app

COPY . .

RUN bun install
--frozen-lockfile && bun build src/index.ts --outdir dist --target bun

FROM oven/bun:1-slim

WORKDIR /app

COPY --from=builder
/app/dist ./dist

EXPOSE 3001

CMD ["bun",
"dist/index.js"]

docker-compose.yml  (root):

services:

  web:

    build: apps/web

    environment:
[NEXT_PUBLIC_API_URL=http://server:3001]

  server:

    build: apps/server

    volumes: [./data:/app/data]    # DB persistence

    environment:
[DB_PATH=/app/data/launchpad.db.json]

  caddy:

    image: caddy:2-alpine

    ports: ["80:80",
"443:443"]

    volumes: [./Caddyfile:/etc/caddy/Caddyfile,
caddy_data:/data]

# 11. Phase 11 — AI Security Scanner

|  **Future Phase** Phase 11
  is deferred and will be built after Phase 10 is stable in production. The route

| stub (/api/ai/security-scan/:serverId) is reserved from Phase 3 onwards. |
| ------------------------------------------------------------------------ |

## 11.1  Scan Targets

•
Exposed ports: runs nmap or
ss -tlnp — flags unexpected open ports

•
Docker image CVEs: docker
scout cves or trivy image — summarises critical/high severity

•
Nginx / Caddy config
weaknesses: missing HSTS, weak TLS versions, open directory listing

•
SSH config: PermitRootLogin,
PasswordAuthentication, MaxAuthTries

•
Running containers with
--privileged flag or exposed docker socket

## 11.2  API Route

GET
/ai/security-scan/:serverId

Streams scan progress via SSE.
Final event contains structured report JSON.

## 11.3  Report Shape

{

  "scannedAt": "ISO8601",

  "serverId": "...",

  "summary": { "critical":
2, "high": 5, "medium": 3, "low": 8 },

  "findings": [

    { "severity":
"critical", "category": "cve",

    "title": "CVE-2024-XXXX in
nginx:1.24",

    "description": "...",
"remediation": "..." }

  ]

}

## 11.4  UI

•
Security tab per server —
shows last scan date + summary badge

•
Run Scan button — live
progress bar, then structured findings list

•
Findings sorted by severity
— critical (red) → high (orange) → medium (yellow) → low (grey)

•
Each finding: expandable
row with description + remediation steps

•
Export as PDF report button

# 12. Shared Types Reference

(@launchpad/shared)

| **File**                                                            | **Exports** |
| ------------------------------------------------------------------------- | ----------------- |
| auth.ts                                                                   | AuthConfig,       |
| AuthSession, LoginInput, AuthResponse, RateLimitState                     |                   |
| server.ts                                                                 | Server,           |
| ServerCreateInput, ServerUpdateInput, ServerConnectionStatus              |                   |
| project.ts                                                                | Project,          |
| ProjectNotificationConfig, OutboundWebhook, ProxyType, ProjectCreateInput |                   |
| deploy.ts                                                                 | DeployRecord,     |
| DeployStatus, DeployTrigger, DeployLogEvent, WebhookPayload,              |                   |
| DeployTriggerInput                                                        |                   |
| notifications.ts                                                          | SmtpConfig,       |
| NotificationSettings, GlobalWebhook, NotificationEvent                    |                   |

# 13. Design System

## 13.1  Colour Tokens  (CSS variables in globals.css)

| **Variable**                    | **Hex** | **Usage** |
| ------------------------------------- | ------------- | --------------- |
| --bg                                  | #0D0D0F       | Page            |
| background                            |               |                 |
| --surface                             | #111114       | Card / panel    |
| background                            |               |                 |
| --surface-2                           | #18181D       | Input /         |
| nested surface                        |               |                 |
| --border                              | #26262E       | All borders     |
| --text                                | #E8E8EF       | Primary text    |
| --text-muted                          | #6B6B7E       | Labels,         |
| captions, placeholders                |               |                 |
| --green                               | #00E57A       | Primary         |
| accent — deploy success, CTA buttons |               |                 |
| --green-dim                           | #00E57A1A     | Active nav      |
| background                            |               |                 |
| --red                                 | #FF4757       | Errors,         |
| failed deploys                        |               |                 |
| --red-dim                             | #FF47571A     | Error           |
| backgrounds                           |               |                 |
| --yellow                              | #FFB83F       | Warnings,       |
| stderr output                         |               |                 |
| --blue                                | #4E9EFF       | Informational,  |
| deploying state                       |               |                 |

## 13.2  Typography

•
UI font: Inter (Google
Fonts) — all chrome, labels, body text

•
Terminal font: JetBrains
Mono — LogStream, env editor, proxy config editor, code snippets

•
Font size scale: 12px (xs)
/ 14px (sm, default) / 16px (md) / 20px (lg) / 24px (xl)

## 13.3  Component Library  (components/ui/)

|  **Component**       |  **Props /

| Notes**                                                 |                |
| ------------------------------------------------------- | -------------- |
| Button.tsx                                              | variant:       |
| primary                                                 | ghost          |
| Input.tsx                                               | label, error,  |
| hint — wraps native input with consistent styling      |                |
| AuthGate.tsx                                            | Redirects      |
| based on isSetup + authenticated state from AuthContext |                |
| ConnectionBadge.tsx                                     | Phase 3 —     |
| green/red/grey dot + latency ms                         |                |
| DeployButton.tsx                                        | Phase 4 —     |
| idle/deploying states, disabled during active deploy    |                |
| LogStream.tsx                                           | Phase 4 — SSE |
| terminal, auto-scroll, timestamps                       |                |
| EnvEditor.tsx                                           | Phase 6 —     |
| KEY=VALUE syntax highlight, diff before save            |                |
| ProxyEditor.tsx                                         | Phase 8 —     |
| Caddyfile / Nginx syntax highlight                      |                |

# 14. Coding Conventions

## 14.1  Server (ElysiaJS)

•
Every protected handler's
first line: requireAuth() — throws 401 if no valid session

•
All DB writes go through
getDb() → mutate → saveDb()

•
Sensitive fields always
pass through encrypt() before write, decrypt() after read

•
SSH connections opened
per-request and disposed in a finally block — no persistent connections

•
SSE routes use Elysia's
built-in response streaming — Content-Type: text/event-stream

•
Route files export a named
Elysia plugin: export const xRoutes = new Elysia({ prefix: '/x' })

## 14.2  Web (Next.js)

•
Server components for
static/data-fetching pages, client components ('use client') only where
interactivity needed

•
All API calls go through
lib/api.ts — never raw fetch in components

•
Form submissions:
controlled state + async handler, never native form submission

•
Errors shown via Sonner
toast (import { toast } from "sonner") — not alert()

•
Tailwind utility classes
preferred; cn() helper for conditional class merging

•
CSS variables from
globals.css used via style={{ color: 'var(--green)' }} for dynamic values

## 14.3  Shared Types

•
All cross-package types
live in packages/shared/src/ — never duplicated

•
Import as: import type {
Server } from '@launchpad/shared'

•
CreateInput and UpdateInput
types derived from base types via Omit/Partial

## 14.4  File Naming

•
Route files: lowercase,
camelCase — servers.ts, deployHistory.ts

•
React components:
PascalCase — DeployButton.tsx, ServerCard.tsx

•
Lib files: camelCase —
crypto.ts, rateLimit.ts, authMiddleware.ts

•
Next.js pages: page.tsx,
layout.tsx (Next.js convention)

# 15. Environment Variables

## apps/server/.env

| **Variable**                                  | **Default**     | **Description** |
| --------------------------------------------------- | --------------------- | --------------------- |
| PORT                                                | 3001                  | Elysia server         |
| port                                                |                       |                       |
| WEB_URL                                             | http://localhost:3000 | Allowed CORS          |
| origin (Next.js URL)                                |                       |                       |
| DB_PATH                                             | ./launchpad.db.json   | Path to               |
| encrypted JSON database                             |                       |                       |
| SESSION_SECRET                                      | random                |                       |
| 32-byte hex                                         | HMAC signing          |                       |
| secret for sessions — set explicitly in production |                       |                       |
| NODE_ENV                                            | development           | Set to                |
| production for secure cookie flags                  |                       |                       |

## apps/web/.env.local

| **Variable**                         | **Default**     | **Description** |
| ------------------------------------------ | --------------------- | --------------------- |
| NEXT_PUBLIC_API_URL                        | http://localhost:3001 | Elysia server         |
| URL — proxied via next.config.ts rewrites |                       |                       |

# 16. Running Locally

Prerequisites: Bun >= 1.3

Clone the repo and install
dependencies:

git clone `<repo>`
&& cd launchpad

bun install

10.Copy
env files:

cp
apps/server/.env.example apps/server/.env

cp
apps/web/.env.example
apps/web/.env.local

11.Start
both apps from root:

bun dev

12.Open
http://localhost:3000 — you will be redirected to /setup on first launch.

13.Set
your master password. All subsequent logins use this password to decrypt
credentials.

# Appendix — Phase Build Checklist

Use this as a task tracker when
implementing each phase.

| **Phase**                                 | **Task** | **Done?** |
| ----------------------------------------------- | -------------- | --------------- |
| 3                                               | servers.ts     |                 |
| route file with CRUD + SSH test                 | ☐             |                 |
| 3                                               | projects.ts    |                 |
| route file with CRUD + webhook secret regen     | ☐             |                 |
| 3                                               | Register       |                 |
| server + project routes in server/src/index.ts  | ☐             |                 |
| 3                                               | ServerCard,    |                 |
| ServerForm, ProjectCard, ProjectForm components | ☐             |                 |
| 3                                               | /servers page  |                 |

+ /servers/[id] page + /servers/[id]/projects/[pid] page   |  ☐          |
  |  4           |  deploy.ts
  route — POST trigger + GET SSE stream + GET history           |  ☐          |
  |  4           |  DeployButton,
  LogStream, DeployStatusBadge, DeployHistory, DeployDrawer  |  ☐          |
  |  4           |  Notification
  pipeline stub (fires after deploy, logs only)               |  ☐          |
  |  5           |  webhooks.ts
  route — inbound HMAC-verified deploy trigger                |  ☐          |
  |  5           |  Webhook
  enable/disable + secret regen UI in ProjectForm                  |  ☐          |
  |  5           |  GitHub
  Actions YAML snippet generator in UI                              |  ☐          |
  |  6           |  env.ts route
  — GET fetch + PUT push over SSH                            |  ☐          |
  |  6           |  EnvEditor +
  EnvDiff components                                           |  ☐          |
  |  6           |  /servers/[id]/projects/[pid]/env
  page                                    |  ☐          |
  |  7           |  images.ts
  route — status, pull, rollback, prune, tags                   |  ☐          |
  |  7           |  ImagePanel,
  TagSelector, RollbackModal, PruneButton components           |  ☐          |
  |  7           |  /servers/[id]/projects/[pid]/images
  page                                 |  ☐          |
  |  8           |  proxy.ts
  route — detect, status, config GET/PUT, reload, sites toggle   |  ☐          |
  |  8           |  ProxyStatusBar,
  ProxyEditor, SitesList, ValidationToast components       |  ☐          |
  |  8           |  /servers/[id]/proxy
  page                                                 |  ☐          |
  |  9           |  mailer.ts —
  Nodemailer + ZeptoMail SMTP transport                       |  ☐          |
  |  9           |  DeploySuccess.tsx
+ DeployFailed.tsx React Email templates               |  ☐          |
  |  9           |  notifications.ts
  route — test email, global webhooks CRUD               |  ☐          |
  |  9           |  Wire full
  notification pipeline into deploy.ts                           |  ☐          |
  |  9           |  SMTP +
  webhooks settings UI in /settings                                 |  ☐          |
  |  10          |  Scoped
  Ed25519 deploy keypair generation per server                      |  ☐          |
  |  10          |  Dockerfile
  for apps/server + apps/web                                    |  ☐          |
  |  10          |  docker-compose.yml
  with Caddy SSL termination                            |  ☐          |
  |  10          |  Caddyfile
  template for HTTPS + HTTP redirect                             |  ☐          |
  |  10          |  README
  deployment section                                                |  ☐          |
  |  11          |  SSH-based
  scan: ports, docker CVEs, SSH config, proxy config             |  ☐          |
  |  11          |  AI route with
  SSE scan progress stream                                   |  ☐          |
  |  11          |  Security
  findings UI — severity-sorted, expandable, export PDF          |  ☐          |

*— End of Document —*
