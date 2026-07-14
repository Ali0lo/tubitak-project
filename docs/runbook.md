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
