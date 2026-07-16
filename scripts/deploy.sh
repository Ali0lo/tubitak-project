#!/usr/bin/env bash
# Deploys the current commit to a production host that already has
# this repo checked out and a filled-in .env. Pulls freshly-built
# images (see .github/workflows/cd.yml) where available, rebuilds
# locally otherwise, then does a rolling-ish restart via `up -d`
# (compose recreates only the containers whose config/image changed).
#
# Usage: bash scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

echo "==> Pulling latest images"
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull || {
  echo "WARNING: pull failed for one or more images (expected if GHCR_REPOSITORY"
  echo "isn't set up yet, or this is the first deploy before any CD run) —"
  echo "falling back to building from source."
}

echo "==> Building any images that weren't pulled"
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

echo "==> Starting stack with production overrides"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "==> Running database migrations"
bash scripts/migrate.sh

echo "==> Waiting for services to report healthy"
sleep 5
bash scripts/healthcheck.sh

echo "==> Deploy complete"
