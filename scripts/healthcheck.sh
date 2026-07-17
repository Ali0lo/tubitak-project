#!/usr/bin/env bash
# Curls every service's /health endpoint and reports pass/fail for
# each. Useful as a quick post-deploy sanity check, or from cron
# outside of Prometheus/Grafana. Exits non-zero if any service is
# unhealthy, so it's usable as a CI/deploy gate too.
#
# Usage: bash scripts/healthcheck.sh [base_host]
# base_host defaults to localhost, using the dev-only per-service
# ports from docker-compose.override.yml. Pass a different host to
# check a deployed environment reachable only via the gateway/nginx —
# in that case only the gateway's own /health and the frontend are
# checkable from outside the docker network.
#
# NOTE: uses parallel indexed arrays rather than an associative array
# (`declare -A`) deliberately — associative arrays require bash 4+,
# and macOS ships bash 3.2 by default, where they fail outright.
set -uo pipefail

HOST="${1:-localhost}"

NAMES=(
  "auth-service"
  "core-service"
  "ai-service"
  "notification-service"
  "gateway"
  "gateway-aggregated"
  "frontend"
)
URLS=(
  "http://${HOST}:8001/health"
  "http://${HOST}:8002/health"
  "http://${HOST}:8003/health"
  "http://${HOST}:8004/health"
  "http://${HOST}:8000/health"
  "http://${HOST}:8000/health/services"
  "http://${HOST}:3000/"
)

FAILED=0

for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"
  url="${URLS[$i]}"
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  status="${status:-000}"
  if [ "$status" = "200" ]; then
    printf "  \033[32mOK\033[0m    %-24s %s\n" "$name" "$url"
  else
    printf "  \033[31mFAIL\033[0m  %-24s %s (HTTP %s)\n" "$name" "$url" "$status"
    FAILED=1
  fi
done

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "One or more services failed their health check."
  exit 1
fi

echo ""
echo "All services healthy."
