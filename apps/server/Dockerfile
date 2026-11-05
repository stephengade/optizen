# ── deps ──────────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY bun.lock bunfig.toml package.json turbo.json tsconfig.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

# ── build: bundle the API into a single file ──────────────────────────────────
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN bun run --cwd apps/server build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/app/data/launchpad.db.json
COPY --from=build /app/apps/server/dist ./dist
# /app/data: encrypted Launchpad database (mount a volume)
# /app/ssh:  private keys, mounted read-only; reference them in the UI as /app/ssh/<file>
RUN mkdir -p /app/data /app/ssh
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "run", "dist/index.js"]
