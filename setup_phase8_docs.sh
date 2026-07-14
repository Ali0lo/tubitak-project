#!/usr/bin/env bash
# Todotak - Phase 8: Finalize
#
# Fills in the three empty docs left over from earlier phases:
#   docs/production-checklist.md
#   docs/runbook.md
#   docs/disaster-recovery.md
#
# All three are written specifically against the stack built in
# Phase 7 (docker-compose.yml / docker-compose.prod.yml / infra/),
# not generic boilerplate.
#
# Run from the root of your todotak/ repo:
#   bash setup_phase8_docs.sh
set -euo pipefail

echo '==> Creating directories'
mkdir -p "docs"

echo '==> Writing docs/production-checklist.md'
cat > "docs/production-checklist.md" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing docs/runbook.md'
cat > "docs/runbook.md" << 'TODOTAK_EOF'
# Operations Runbook

Day-to-day operational commands and troubleshooting for the Todotak
stack. Assumes you're on the host running Docker Compose, in the repo
root, with `.env` already populated.

## Service map

| Service               | Container name              | Internal port | Host port (dev) | Depends on                          |
|------------------------|------------------------------|:---:|:---:|--------------------------------------|
| postgres                | todotak-postgres             | 5432 | 5432 | —                                    |
| redis                   | todotak-redis                | 6379 | 6379 | —                                    |
| auth-service             | todotak-auth-service          | 8000 | 8001 | postgres, redis                      |
| core-service             | todotak-core-service          | 8000 | 8002 | postgres, redis, auth-service        |
| ai-service               | todotak-ai-service            | 8000 | 8003 | postgres, redis, core-service        |
| notification-service     | todotak-notification-service  | 8000 | 8004 | postgres, redis, auth-service        |
| notification-worker      | todotak-notification-worker   | —    | —    | notification-service                 |
| gateway                  | todotak-gateway               | 8000 | 8000 | redis + all 4 backend services       |
| frontend                 | todotak-frontend              | 3000 | 3000 | gateway                              |
| nginx (prod only)        | todotak-nginx                 | 80/443 | 80/443 | gateway, frontend                  |

Redis is one instance, split by DB index: `0` auth/core, `1` gateway
(rate limiting), `2` ai-service, `3` notification-service (dispatch
queue). If you ever need to inspect one service's keys without
seeing another's, `redis-cli -n <index>`.

## Starting / stopping

```bash
# Local dev
docker compose up -d --build
docker compose down                 # stop, keep volumes
docker compose down -v              # stop, WIPE postgres/redis data

# Production (Nginx + hardened config)
make up-prod
make down-prod
```

## Checking status

```bash
docker compose ps                   # look for "healthy", not just "Up"
docker compose logs -f gateway      # tail one service
docker compose logs -f              # tail everything (noisy)
```

The **notification-worker** has no `HEALTHCHECK` (it's a background
loop, not an HTTP server), so `docker compose ps` will just show
"Up", never "healthy". Confirm it's actually doing something with:

```bash
docker compose logs -f notification-worker
```

You should see periodic scheduler/dispatch loop log lines at the
interval set by `SCHEDULER_POLL_INTERVAL_SECONDS` (default 15s). If
the logs go silent, restart it: `docker compose restart notification-worker`.

## Health endpoints

Every FastAPI service exposes `GET /health`:

```bash
curl http://localhost:8000/health   # gateway
curl http://localhost:8001/health   # auth-service
curl http://localhost:8002/health   # core-service
curl http://localhost:8003/health   # ai-service
curl http://localhost:8004/health   # notification-service
```

Expected response: `{"status": "ok", "service": "<name>"}`.

## Running migrations manually

Normally each service runs `alembic upgrade head` automatically on
container start (baked into `docker-compose.yml`'s `command:`). To
run one manually, e.g. after pulling new migration files without a
full restart:

```bash
docker compose exec auth-service alembic upgrade head
docker compose exec core-service alembic upgrade head
docker compose exec ai-service alembic upgrade head
docker compose exec notification-service alembic upgrade head
```

Or all at once: `make migrate`.

To see current migration state vs. what's available:

```bash
docker compose exec auth-service alembic current
docker compose exec auth-service alembic history
```

## Common issues

**A service is unhealthy / restarting in a loop.**
Check its logs first — almost always either (a) it can't reach
Postgres/Redis yet (shouldn't happen given the `depends_on:
condition: service_healthy` ordering, but check `docker compose ps`
for postgres/redis health if it does), or (b) a migration failed.
`docker compose logs <service>` will show the Alembic traceback if
it's (b).

**401s on every request through the gateway, even with a valid-looking token.**
`JWT_SECRET_KEY` is not identical across auth-service and whichever
service is rejecting the token. Check `.env` was actually reloaded
(`docker compose up -d --build <service>` after any `.env` edit —
Compose does not hot-reload environment variables into running
containers).

**core-service can't reach notification-service (task reminders silently not scheduled).**
This fails soft by design (see `core-service/app/clients/notification_client.py`
— a notification failure never blocks the task/reminder write), so
you won't get an error in the UI. Check
`docker compose logs core-service | grep -i notification` for the
warning, and confirm `INTERNAL_SERVICE_API_KEY` matches between
core-service and notification-service.

**"relation does not exist" errors after a fresh `docker compose up`.**
Migrations haven't run yet, or ran against the wrong schema. Confirm
`infra/postgres/init.sql` ran (only fires on a *first-ever* volume
init — if you've run this stack before, the `postgres_data` volume
already exists and init scripts are skipped). Check schemas exist:

```bash
docker compose exec postgres psql -U todotak -d todotak -c '\dn'
```

Expect `auth`, `core`, `ai`, `notification`.

**Frontend loads but every API call 404s or CORS-errors.**
Check `NEXT_PUBLIC_GATEWAY_URL` inside the frontend container matches
where the gateway actually is (`http://gateway:8000` in Docker, not
`http://localhost:8000` — from inside a container, `localhost` is the
container itself). And check `CORS_ORIGINS` on the gateway includes
the exact origin the frontend is served from.

## Rotating secrets

1. Generate new value(s).
2. Update `.env` on the host.
3. Recreate every container that reads the changed variable (not just
   restart — Compose only re-reads `.env` on `up`):
   ```bash
   docker compose up -d
   ```
4. If `JWT_SECRET_KEY` was rotated: every previously issued access/
   refresh token is now invalid. All users get logged out. Communicate
   this before rotating in production, don't discover it after.

## Scaling a service

Stateless services (gateway, core-service, ai-service — anything
without its own background worker) can run multiple replicas behind
Nginx:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --scale core-service=3
```

Don't scale `notification-worker` beyond 1 replica without first
checking `app/workers/scheduler_worker.py` and `dispatch_worker.py`
for how they claim work from the Redis queue — if they're not
built to coordinate over multiple instances, scaling it will cause
duplicate notification sends.
TODOTAK_EOF

echo '==> Writing docs/disaster-recovery.md'
cat > "docs/disaster-recovery.md" << 'TODOTAK_EOF'
# Disaster Recovery

What to do when something is actually broken, not just degraded.
Pair this with `runbook.md` for day-to-day troubleshooting — this
doc is for backups, restores, and full-stack rebuilds.

## What's actually stateful

Only two things hold data that isn't reproducible from source:

- **`postgres_data`** volume — all application data (users, tasks,
  meetings, reminders, AI conversation history, notification records)
  across all 4 schemas.
- **`redis_data`** volume — persisted via `appendonly yes` in
  `infra/redis/redis.conf`, holding the gateway's rate-limit counters
  and notification-service's dispatch queue. Losing this is annoying
  (queued notifications in flight are lost, rate limits reset) but
  not catastrophic — nothing here is the source of truth for
  anything; it can be rebuilt from Postgres state plus a cold start.

Everything else (containers, images, configs) is rebuildable from the
git repo in minutes. Treat Postgres backups as the only thing that
actually matters here.

## Backup: Postgres

Manual, on-demand backup:

```bash
docker compose exec -T postgres pg_dump -U todotak -d todotak --format=custom \
  > backups/todotak-$(date +%Y%m%d-%H%M%S).dump
```

Scheduled (add to host crontab, not inside a container — you want
the backup to survive `docker compose down -v`):

```cron
0 3 * * * cd /path/to/todotak && docker compose exec -T postgres pg_dump -U todotak -d todotak --format=custom > /path/to/backups/todotak-$(date +\%Y\%m\%d).dump
```

Copy backups off the host (S3, another server, wherever) — a backup
that lives on the same disk as the database it's backing up doesn't
protect you from disk failure.

**Retention**: keep at minimum the last 7 daily backups and last 4
weekly backups. Adjust to your actual RPO tolerance (see below).

## Restore: Postgres

```bash
# Stop everything that writes to the DB first
docker compose stop auth-service core-service ai-service notification-service notification-worker gateway

docker compose exec -T postgres pg_restore -U todotak -d todotak --clean --if-exists \
  < backups/todotak-YYYYMMDD-HHMMSS.dump

docker compose start auth-service core-service ai-service notification-service notification-worker gateway
```

If restoring into a brand-new environment (not just an existing
container), bring up `postgres` alone first, wait for it healthy,
then restore, then bring up everything else — otherwise the app
services' automatic `alembic upgrade head` on startup may race with
your restore.

## Full stack rebuild from scratch

If the host itself is gone (not just a container):

1. Provision new host, install Docker + Compose plugin.
2. Clone the repo, `cp .env.example .env`, fill in the **same**
   secrets as before if you have them recorded somewhere secure
   (rotating `JWT_SECRET_KEY`/`INTERNAL_SERVICE_API_KEY` here is fine
   if the old ones are actually lost — it just logs out all users and
   nothing else breaks).
3. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
4. Once `postgres` is healthy, stop the app services, restore the
   latest Postgres backup (see above), then start them.
5. Verify: `docker compose ps` all healthy, hit `/health` on each
   service, log in through the frontend, create a test task.
6. Point DNS at the new host if the IP changed.

## Partial failure scenarios

**Postgres container won't start / data corruption suspected.**
Don't `rm -rf` the volume as a first move. First try
`docker compose logs postgres` — most "won't start" issues are
permission or disk-space related, not corruption. If it really is
corrupted, restore from the most recent backup into a fresh volume
rather than attempting in-place repair.

**A bad migration was deployed and needs undoing.**
Alembic downgrades are not automatic and not guaranteed to be
lossless (a migration that drops a column can't un-drop it without
data loss). Preferred order of operations:
1. If caught immediately and no meaningful writes happened since:
   `docker compose exec <service> alembic downgrade -1`, then fix
   forward.
2. If data has already been written under the new schema: restore
   the pre-migration Postgres backup instead of downgrading — it's
   the only way to guarantee consistency. This is exactly why the
   production checklist requires a fresh backup immediately before
   any deploy that includes migrations.

**Redis is lost entirely (volume deleted, corrupted, whatever).**
Just start it fresh — `docker compose up -d redis`. Rate limits
reset (harmless) and any notifications mid-dispatch in the queue are
lost (re-check `notification-service`'s DB records — undelivered
ones can be re-enqueued once you write that reconciliation logic;
not present as of Phase 8, tracked as a known gap).

**One backend service is down but the rest of the stack is fine.**
The gateway does not currently have per-route circuit breaking — a
downstream service being down will make its routes fail, not take
down the gateway itself. Users hitting unrelated features are
unaffected. `docker compose up -d <service>` to bring it back;
`depends_on: condition: service_healthy` on downstream containers
(e.g. ai-service depends on core-service) means anything depending on
the recovered service will reconnect automatically, no cascading
restart needed.

## Recovery objectives (fill in for your actual deployment)

- [ ] **RPO (Recovery Point Objective)** — how much data loss is
      acceptable? Backup frequency above is set for a same-day RPO;
      tighten it (e.g. WAL archiving / continuous backup) if that's
      not good enough for your use case.
- [ ] **RTO (Recovery Time Objective)** — how long can the app be
      down? A full rebuild-from-scratch as documented above takes
      roughly: provisioning (varies) + `docker compose up -d --build`
      (~5-10 min for images to build) + restore (varies with DB size).
      Time an actual drill rather than assuming.
TODOTAK_EOF

echo '==> Phase 8 docs written successfully'
echo ''
echo 'Files written:'
echo '  docs/production-checklist.md'
echo '  docs/runbook.md'
echo '  docs/disaster-recovery.md'
echo ''
echo 'Note: some checklist/runbook items describe things not yet built'
echo '(TLS certs mounted, /metrics instrumentation, backup cron job,'
echo 'notification requeue-on-redis-loss). Those are called out inline'
echo 'as known gaps rather than glossed over - worth a final pass to'
echo 'either close them or consciously accept them before going live.'