#!/usr/bin/env bash
# Restores a database dump produced by scripts/backup.sh.
#
# DESTRUCTIVE: drops and recreates every table in the target database
# before loading the dump. Requires typing the database name to
# confirm, since this cannot be undone.
#
# Usage:
#   bash scripts/restore.sh path/to/todotak-TIMESTAMP.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: bash scripts/restore.sh path/to/backup.sql.gz" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Run this from the repo root with .env present." >&2
  exit 1
fi

POSTGRES_USER=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- || echo "todotak")
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- || echo "todotak")
POSTGRES_USER="${POSTGRES_USER:-todotak}"
POSTGRES_DB="${POSTGRES_DB:-todotak}"

echo "This will PERMANENTLY REPLACE all data in database '${POSTGRES_DB}'."
echo "Type the database name to confirm: "
read -r CONFIRMATION
if [ "$CONFIRMATION" != "$POSTGRES_DB" ]; then
  echo "Confirmation did not match '${POSTGRES_DB}'. Aborting."
  exit 1
fi

echo "==> Dropping and recreating public schema plus service schemas"
docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;
DROP SCHEMA IF EXISTS ai CASCADE;
DROP SCHEMA IF EXISTS notification CASCADE;
SQL

echo "==> Loading ${BACKUP_FILE}"
gunzip -c "${BACKUP_FILE}" | docker compose exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

echo "==> Restore complete"
