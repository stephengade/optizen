FROM oven/bun:1 AS base

WORKDIR /app

COPY bun.lock bunfig.toml package.json turbo.json tsconfig.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN bun install --frozen-lockfile

COPY . .

RUN bun run --cwd apps/web build

WORKDIR /app/apps/web

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "start"]
