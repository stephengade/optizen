#!/usr/bin/env bash
# Server side of the GitHub Actions deploy (.github/workflows/deploy.yml).
#
# Install a copy OUTSIDE the repo (so a push cannot change what the key may run), e.g.
#   install -m 755 deploy/remote-deploy.sh ~/bin/optizen-deploy
# and pin the deploy key to it in ~/.ssh/authorized_keys:
#   restrict,command="/home/<user>/bin/optizen-deploy" ssh-ed25519 AAAA... optizen-github-actions-deploy
# Whatever command the client sends is ignored: the key can only fast-forward to the latest main,
# rebuild and restart Optizen.
set -euo pipefail

APP_DIR="${OPTIZEN_DIR:-/opt/optizen}"
BRANCH="${OPTIZEN_BRANCH:-main}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.gateway.yml)

exec 9>/tmp/optizen-deploy.lock
flock -n 9 || { echo "Another deploy is already running." >&2; exit 1; }

cd "$APP_DIR"
before=$(git rev-parse --short HEAD)
git fetch --quiet origin "$BRANCH"
# Refuse to deploy if the server copy has diverged (someone edited it by hand).
git merge --ff-only --quiet "origin/$BRANCH"
after=$(git rev-parse --short HEAD)
echo "Deploying $before -> $after"

# Builds first; running containers are only replaced if the build succeeds.
"${COMPOSE[@]}" up -d --build --remove-orphans
docker image prune -f >/dev/null

server=$("${COMPOSE[@]}" ps -q server)
for _ in $(seq 1 45); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$server" 2>/dev/null || echo unknown)
  [ "$status" = healthy ] && break
  sleep 2
done
if [ "$status" != healthy ]; then
  echo "API container is not healthy (status: $status)." >&2
  "${COMPOSE[@]}" logs --tail 40 server | grep -v 'Setup code' >&2
  exit 1
fi

"${COMPOSE[@]}" ps --format '{{.Name}}: {{.Status}}'
echo "Deployed $after."
