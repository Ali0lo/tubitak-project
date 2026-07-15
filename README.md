# Todotak

An AI-powered to-do and meeting assistant. Manage tasks, meetings, and
reminders through a conventional UI or entirely through natural-language
chat with an OpenAI tool-calling agent.

## Architecture

Six backend services, one frontend, sitting behind an API gateway:

```
                         ┌─────────┐
                         │  nginx  │  (edge proxy, port 80)
                         └────┬────┘
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐      ┌──────▼──────┐
              │  frontend │      │   gateway   │  (rate limiting,
              │ (Next.js) │      │             │   request routing)
              └───────────┘      └──────┬──────┘
                                          │
        ┌───────────────┬────────────────┼────────────────┐
        │                │                │                │
  ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼─────┐  ┌───────▼───────┐
  │auth-service│   │core-service │  │ ai-service │  │notification-   │
  │            │   │(tasks,      │  │(OpenAI     │  │service          │
  │(JWT, users)│   │ meetings,   │  │ tool-calling│  │(email + in-app) │
  │            │   │ reminders)  │  │ agent)     │  │                 │
  └─────┬──────┘   └──────┬──────┘  └─────┬──────┘  └────────┬────────┘
        │                 │                │                  │
        └─────────────────┴────────┬───────┴──────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   PostgreSQL 16    │  (one instance,
                          │ (per-service schema)│  4 schemas)
                          └─────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │       Redis        │  (rate limiting,
                          │                    │   notification queue)
                          └─────────────────────┘
```

Every service owns its own Postgres **schema** (not a separate
database) — `auth`, `core`, `ai`, `notification` — migrated
independently via each service's own Alembic setup. Services never
reach into another service's tables directly; all cross-service
communication is over HTTP, authenticated either by a forwarded user
JWT (verified via a shared `JWT_SECRET_KEY`) or, for the handful of
internal-only endpoints core-service and notification-service call
directly, a shared `INTERNAL_SERVICE_API_KEY`.

The **ai-service agent never touches the database on your behalf** —
every task/meeting/reminder action it takes goes through core-service's
normal HTTP API using your own forwarded access token, so it can never
do anything your account couldn't do directly.

## Prerequisites

- Docker and Docker Compose v2
- An OpenAI API key (for the AI assistant / chat feature)
- (Optional) SMTP credentials, for actual reminder emails to send —
  without them, reminders still work and appear in-app, they just
  won't email you

## Quick start (local development)

```bash
cp .env.example .env
# edit .env: set JWT_SECRET_KEY, INTERNAL_SERVICE_API_KEY, OPENAI_API_KEY
# (generate secrets with: python3 -c "import secrets; print(secrets.token_urlsafe(48))")

make up          # builds and starts everything
make migrate      # runs Alembic migrations for all four services with a DB
```

Then visit:

| What | URL |
|---|---|
| App | http://localhost:3000 |
| API docs (auth-service) | http://localhost:8001/docs |
| API docs (core-service) | http://localhost:8002/docs |
| API docs (ai-service) | http://localhost:8003/docs |
| API docs (notification-service) | http://localhost:8004/docs |
| Grafana | http://localhost:3001 (admin / whatever you set `GRAFANA_ADMIN_PASSWORD` to) |
| Prometheus | http://localhost:9090 |

The gateway itself (port 8000) is a pure reverse proxy with no
meaningful `/docs` of its own — each backend service's interactive
API docs are the ones listed above. All of those direct-service ports
(8001–8004), plus Postgres (5432) and Redis (6379), only exist because
`docker-compose.override.yml` is auto-loaded by plain `docker compose
up` / `make up`. None of them are reachable in production — only the
gateway, frontend, and nginx are.

## Production

```bash
make prod-up
```

This applies `docker-compose.prod.yml` on top of the base file
*without* the dev override, so only nginx (port 80) is reachable.
TLS termination is intentionally left out of `infra/nginx/nginx.conf`
— see the comment in `docker-compose.prod.yml` for the two realistic
ways to add it (a managed load balancer in front, or extending the
nginx config with a certbot-issued cert).

## Running a single service outside Docker

Each service also has its own `.env.example` and can run standalone
(useful when iterating on one service without rebuilding images) — see
that service's own setup instructions delivered alongside its code.
The root `.env` above is what `docker-compose.yml` actually reads;
each service's own `.env` is only used when running it directly with
`uvicorn`.

## Monitoring

None of the six services expose Prometheus-format metrics yet — what
genuinely exists is a `/health` endpoint on each one. Prometheus
monitors those for uptime and latency via the blackbox exporter
(`monitoring/prometheus/`), and Grafana's "Todotak - Service Health"
dashboard visualizes it. If a service later adds real instrumentation
(e.g. `prometheus-fastapi-instrumentator`), add a direct scrape job
for it in `monitoring/prometheus/prometheus.yml` rather than routing
it through blackbox.

## Repository layout

```
auth-service/          JWT auth, users, refresh tokens
core-service/           tasks, meetings, reminders
gateway/                 API gateway: routing, rate limiting
ai-service/               OpenAI tool-calling chat agent
notification-service/      email + in-app notification dispatch
frontend/                   Next.js 14 App Router UI
infra/                        nginx, postgres init, redis config, alert rules
monitoring/                    prometheus scrape config, grafana dashboards
docker-compose.yml               base stack definition (secure by default)
docker-compose.override.yml        dev convenience ports (auto-loaded)
docker-compose.prod.yml              production overrides (explicit -f)
```

## Common commands

Run `make help` for the full list. The essentials:

```bash
make up             # start everything (dev)
make down           # stop everything
make logs           # tail all logs
make migrate        # run all Alembic migrations
make test-unit      # run every dependency-free test suite
make shell-db       # psql into the running Postgres container
```
