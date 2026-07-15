#!/usr/bin/env bash
# Runs `alembic upgrade head` inside each service that owns a database
# schema. Assumes the stack is already up (docker compose up -d) and
# postgres is healthy — invoked by `make migrate`.
set -euo pipefail

SERVICES=(auth-service core-service ai-service notification-service)

for service in "${SERVICES[@]}"; do
  echo "==> Running migrations for ${service}"
  docker compose exec -T "${service}" alembic upgrade head
done

echo "==> All migrations complete"
