# Production Checklist

Work through this before pointing a real domain at the stack, and
again before every subsequent deploy that touches secrets, schema,
or infra config. Check items off as you go; don't skip steps because
"it worked last time."

## 1. Secrets

- [ ] `.env` on the production host is NOT the committed `.env.example`
      — every value below has been changed from its placeholder:
  - [ ] `POSTGRES_PASSWORD` — long, random, unique to this environment
  - [ ] `JWT_SECRET_KEY` — long, random (`python3 -c "import secrets; print(secrets.token_urlsafe(48))"`)
        and **identical** across auth-service, core-service, ai-service,
        notification-service (they verify each other's tokens locally)
  - [ ] `INTERNAL_SERVICE_API_KEY` — long, random, identical across
        auth-service, core-service, notification-service
  - [ ] `OPENAI_API_KEY` — a real, billable key with usage limits set
        on the OpenAI dashboard
  - [ ] `SMTP_USERNAME` / `SMTP_PASSWORD` — real provider credentials,
        not the localhost defaults
- [ ] `.env` is in `.gitignore` and has never been committed (check
      `git log --all --full-history -- .env`)
- [ ] Secrets are not visible in `docker compose config` output shared
      with anyone outside the team, and not printed in CI logs

## 2. Environment / config

- [ ] `ENVIRONMENT=production` and `DEBUG=false` for every backend
      service (Phase 7's `docker-compose.prod.yml` sets this already —
      confirm it's actually the compose file being used:
      `docker compose -f docker-compose.yml -f docker-compose.prod.yml ...`)
- [ ] `CORS_ORIGINS` in `.env` lists your real frontend domain
      (`https://app.yourdomain.com`), not `http://localhost:3000`
- [ ] `NEXT_PUBLIC_GATEWAY_URL` / `NEXT_PUBLIC_API_BASE_URL` point at
      the real gateway route, not localhost
- [ ] Rate limit values (`RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS`
      on the gateway) reviewed for expected real-world traffic, not
      left at dev defaults

## 3. Database

- [ ] Migrations applied and verified on production data before
      cutover: `make migrate` (or run manually per service, see
      runbook)
- [ ] Confirmed all 4 schemas exist: `auth`, `core`, `ai`, `notification`
      (`\dn` in `psql`)
- [ ] A fresh backup exists from *before* this deploy's migrations ran
      (see disaster-recovery.md)
- [ ] Postgres data volume (`postgres_data`) is on persistent storage
      that survives a host reboot, not ephemeral disk
- [ ] Connection count sanity-checked — 4 services each holding a
      pool against one Postgres instance; confirm `max_connections`
      comfortably covers `(pool_size × service_count) + headroom`

## 4. Networking / TLS

- [ ] DNS for the production domain points at the host running Nginx
- [ ] Nginx is serving real TLS certs (Phase 7's `docker-compose.prod.yml`
      leaves `443` commented out and expects certs mounted at
      `infra/nginx/certs` — get real certs, e.g. via certbot, before
      enabling it)
- [ ] HTTP → HTTPS redirect configured once TLS is live (not yet in
      `infra/nginx/default.conf` — add before relying on it)
- [ ] Only Nginx's ports (80/443) are reachable from outside the host;
      confirm with `docker compose -f docker-compose.yml -f docker-compose.prod.yml config`
      that no other service still publishes a host port
- [ ] Host firewall (ufw/security group) blocks 5432, 6379, 8000-8004,
      3000 from the public internet — Docker's own port publishing
      bypasses ufw's default rules on Linux, so don't rely on ufw
      alone if you also removed the `ports:` entries in prod

## 5. Health & readiness

- [ ] `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps`
      shows every service as `healthy`, not just `running`
- [ ] `curl` each service's `/health` from inside the `todotak-network`
      returns `{"status": "ok", ...}`
- [ ] Notification worker container is actually running (it has no
      healthcheck — see runbook for how to confirm it's alive)
- [ ] A test task/meeting/reminder created end-to-end through the
      frontend, and a test notification actually arrives by email

## 6. Observability

- [ ] Container logs are going somewhere durable (`docker compose logs`
      only keeps what the Docker log driver retains — set up log
      rotation or shipping before you need to debug an incident from
      three days ago)
- [ ] Someone is actually looking at `docker compose ps` / uptime on a
      schedule, or an external uptime check hits `/health` through
      Nginx on an interval
- [ ] Prometheus/Grafana: still placeholder as of Phase 7 (no service
      exposes `/metrics` yet) — either add `prometheus_client`
      instrumentation before relying on it, or treat monitoring as a
      known gap, not a false sense of coverage

## 7. Rollback readiness

- [ ] You know the previous working image tag / git commit before
      deploying
- [ ] Rollback plan for a bad migration is written down (Alembic
      downgrade is not automatic — see disaster-recovery.md)
- [ ] `scripts/release.sh` (or whatever performs the deploy) is
      re-runnable / idempotent, not a one-shot script that leaves
      things half-applied if it fails partway
