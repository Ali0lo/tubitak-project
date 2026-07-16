#!/usr/bin/env bash
# Runs Alembic migrations for every service that owns a database
# schema. Thin wrapper so `scripts/deploy.sh` and `make migrate` both
# have an obvious, discoverable entrypoint; the actual work lives in
# infra/docker/run-migrations.sh alongside the rest of the docker
# infrastructure it depends on (a running, healthy `docker compose`
# stack).
set -euo pipefail
cd "$(dirname "$0")/.."
bash infra/docker/run-migrations.sh
