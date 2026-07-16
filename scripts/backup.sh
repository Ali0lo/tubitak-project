#!/usr/bin/env bash
# Dumps the running Postgres database (all four service schemas, one
# database) to a timestamped, gzip-compressed file. Safe to run while
# the stack is up — pg_dump takes an internally-consistent snapshot
# without blocking writes.
#
# Usage:
#   bash scripts/backup.sh [output_directory]
#
# output_directory defaults to ./backups (created if missing).
set -euo pipefail
cd "$(dirname "$0")/.."

OUTPUT_DIR="${1:-./backups}"
mkdir -p "$OUTPUT_DIR"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Run this from the repo root with .env present." >&2
  exit 1
fi

POSTGRES_USER=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- || echo "todotak")
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- || echo "todotak")
POSTGRES_USER="${POSTGRES_USER:-todotak}"
POSTGRES_DB="${POSTGRES_DB:-todotak}"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
OUTPUT_FILE="${OUTPUT_DIR}/todotak-${TIMESTAMP}.sql.gz"

echo "==> Backing up database '${POSTGRES_DB}' to ${OUTPUT_FILE}"
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --format=plain --no-owner \
  | gzip > "${OUTPUT_FILE}"

SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo "==> Backup complete: ${OUTPUT_FILE} (${SIZE})"
echo ""
echo "Restore with: bash scripts/restore.sh ${OUTPUT_FILE}"
