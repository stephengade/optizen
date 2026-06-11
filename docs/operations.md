# Launchpad Operations Guide

Launchpad is a lightweight control plane for self-hosted VPS workloads. The current milestone focuses on trust, observability, and safer operator workflows before GitHub bootstrap automation is added.

## Mental model

- Servers are SSH connection records plus telemetry snapshots.
- Projects are deploy contracts attached to a server.
- Deploys are historical outcomes and logs, not the project itself.
- Infra files are edited separately so `.env` and proxy changes have their own review and history surfaces.

This separation keeps the UI legible when a server hosts multiple apps, proxies, and sidecar services.

## Session and security model

- Launchpad stores a master password hash and derives an in-memory encryption key after login.
- Session duration is operator-configurable in Settings.
- Dangerous actions can require a fresh re-authentication window.
- Elevated sessions are time-boxed and only used for high-impact actions like deploys, rollbacks, deletes, env overwrites, proxy writes, and proxy reloads.

This gives operators a practical middle ground between no friction and full re-login on every action.

## Secret visibility and audit trail

- Sensitive panels can be revealed or copied in the UI.
- Reveal and copy actions are written into the activity log.
- Security settings changes and session elevations also create audit events.
- Audit events currently live in the main activity store under the reserved `system` server scope.

This is intentionally simple for a portfolio-friendly MVP: it avoids a second audit subsystem while still proving the end-to-end trust surface.

## Observability model

- Server cards and detail pages surface CPU, uptime, load average, memory, disk, inode pressure, and container counts.
- Project pages track health checks, last successful heartbeat, deploy history, and recent logs.
- Activity timelines show deploys, imports, env writes, proxy edits, rollbacks, and trust-related actions.

The goal is fast operator comprehension, not full APM depth.

## File safety model

- Env and proxy writes validate before applying when practical.
- Pre-change snapshots are stored locally in Launchpad history.
- Remote backups are created before overwrite operations.
- Restore flows also create a fresh backup before rolling back.

This makes destructive file edits reversible without pretending to be a full GitOps system.

## Demo mode and privacy mode

- Demo privacy masks sensitive values across the dashboard.
- Demo mode swaps live data for seeded portfolio-safe infrastructure records.

Together they make the product easier to present without needing a live production environment.
