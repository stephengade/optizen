FROM oven/bun:1 AS base

WORKDIR /app

COPY bun.lock bunfig.toml package.json turbo.json tsconfig.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN bun install --frozen-lockfile

COPY . .

RUN bun run --cwd apps/server build

WORKDIR /app/apps/server

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "run", "dist/index.js"]
