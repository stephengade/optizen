# ── deps: install the whole workspace from the lockfile ───────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY bun.lock bunfig.toml package.json turbo.json tsconfig.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/web apps/web
# Rewrites (/api/* → API) are baked in at build time, so the API address must be known here.
ARG NEXT_PUBLIC_API_URL=http://server:3001
# The site's own address, for canonical URLs and social preview images (see lib/site-meta.ts).
ARG PUBLIC_DOMAIN=
ARG DOMAIN=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    PUBLIC_DOMAIN=$PUBLIC_DOMAIN \
    DOMAIN=$DOMAIN \
    NEXT_TELEMETRY_DISABLED=1
RUN bun run --cwd apps/web build

# ── runtime: Next.js standalone server on Node ───────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
