#!/usr/bin/env bash
# Todotak - infrastructure integration (docker-compose, nginx, monitoring)
# Run this from the root of your todotak/ repo:
#   bash setup_infra.sh
set -euo pipefail

echo '==> Creating infra directories'
mkdir -p "infra/docker"
mkdir -p "infra/grafana"
mkdir -p "infra/nginx"
mkdir -p "infra/postgres"
mkdir -p "infra/prometheus"
mkdir -p "infra/redis"
mkdir -p "monitoring/grafana/dashboards"
mkdir -p "monitoring/grafana/provisioning/dashboards"
mkdir -p "monitoring/grafana/provisioning/datasources"
mkdir -p "monitoring/prometheus"

echo '==> Writing .env.example'
cat > ".env.example" << 'TODOTAK_EOF'
# Consumed directly by docker-compose.yml via ${VAR} interpolation.
# Copy to .env and fill in real values before running `make up`.
#
# NOTE: this is separate from each service's own .env.example. Those
# are for running a service standalone outside Docker; this file is
# what docker-compose actually reads.

ENVIRONMENT=development
DEBUG=true

# --- Postgres --------------------------------------------------------
POSTGRES_USER=todotak
POSTGRES_PASSWORD=todotak
POSTGRES_DB=todotak

# --- Shared auth secrets ----------------------------------------------
# Must be the same value everywhere it's referenced below.
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(64))"
JWT_SECRET_KEY=change-this-in-production-to-a-long-random-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# Shared across auth-service, core-service, and notification-service.
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(48))"
INTERNAL_SERVICE_API_KEY=change-this-to-a-long-random-shared-secret

# --- AI service --------------------------------------------------------
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o

# --- Notification service / SMTP ---------------------------------------
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=true
SMTP_FROM_EMAIL=no-reply@todotak.app

# --- Gateway -------------------------------------------------------------
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_SECONDS=60

# --- Cross-service CORS ---------------------------------------------------
CORS_ORIGINS=["http://localhost:3000"]

# --- Monitoring ------------------------------------------------------------
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change-this-admin-password
TODOTAK_EOF

echo '==> Writing .gitignore'
cat > ".gitignore" << 'TODOTAK_EOF'
# Environment files (never commit real secrets)
.env
.env.local
.env.*.local
!.env.example
!.env.local.example

# Python
__pycache__/
*.py[cod]
*.egg-info/
.pytest_cache/
.ruff_cache/
.mypy_cache/
*.sqlite3

# Node / frontend
node_modules/
.next/
out/
*.tsbuildinfo
npm-debug.log*

# Docker
*.pid

# Editors / OS
.DS_Store
.idea/
.vscode/
*.swp

# Logs
*.log

# Terraform-style local state (if infra ever grows that direction)
*.tfstate
*.tfstate.*
.terraform/

# TLS material — never commit real certs
infra/nginx/certs/
TODOTAK_EOF

echo '==> Writing Makefile'
cat > "Makefile" << 'TODOTAK_EOF'
.PHONY: help up down down-v logs ps build restart \
        prod-up prod-down prod-logs \
        migrate migrate-status \
        test test-unit test-frontend \
        lint format \
        shell-auth shell-core shell-ai shell-notification shell-gateway shell-db

COMPOSE := docker compose

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

## --- Local development (docker-compose.override.yml auto-applied) --------

up: ## Build and start the full stack for local development
	$(COMPOSE) up -d --build

down: ## Stop the stack
	$(COMPOSE) down

down-v: ## Stop the stack and delete all volumes (destroys data)
	$(COMPOSE) down -v

logs: ## Tail logs for every service
	$(COMPOSE) logs -f

ps: ## Show running services
	$(COMPOSE) ps

build: ## Rebuild all images without starting
	$(COMPOSE) build

restart: ## Restart every service
	$(COMPOSE) restart

## --- Production ------------------------------------------------------------

prod-up: ## Build and start the stack with production overrides
	$(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down: ## Stop the production stack
	$(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml down

prod-logs: ## Tail logs for the production stack
	$(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml logs -f

## --- Database ----------------------------------------------------------------

migrate: ## Run Alembic migrations for every service that owns a schema
	bash infra/docker/run-migrations.sh

migrate-status: ## Show current Alembic revision for every service
	@for service in auth-service core-service ai-service notification-service; do \
		echo "== $$service =="; \
		$(COMPOSE) exec -T $$service alembic current; \
	done

## --- Tests -------------------------------------------------------------------

test-unit: ## Run the dependency-free unit tests for every backend service
	$(COMPOSE) run --rm gateway pytest
	$(COMPOSE) run --rm ai-service pytest tests/test_tool_definitions.py tests/test_core_service_client.py tests/test_tool_executor.py
	$(COMPOSE) run --rm notification-service pytest tests/test_redis_queue.py tests/test_email_templates.py tests/test_auth_service_client.py tests/test_email_client.py

test-frontend: ## Run frontend type checking and unit tests
	cd frontend && npm run typecheck && npm test

test: test-unit test-frontend ## Run everything that doesn't require a live database
	@echo "Note: DB-backed integration tests need TEST_DATABASE_URL and are not run by this target."

## --- Code quality --------------------------------------------------------------

lint: ## Lint all Python services with ruff
	ruff check auth-service core-service gateway ai-service notification-service

format: ## Format all Python services with ruff
	ruff format auth-service core-service gateway ai-service notification-service

## --- Shells / debugging ----------------------------------------------------------

shell-auth: ## Open a shell in the running auth-service container
	$(COMPOSE) exec auth-service /bin/bash

shell-core: ## Open a shell in the running core-service container
	$(COMPOSE) exec core-service /bin/bash

shell-ai: ## Open a shell in the running ai-service container
	$(COMPOSE) exec ai-service /bin/bash

shell-notification: ## Open a shell in the running notification-service container
	$(COMPOSE) exec notification-service /bin/bash

shell-gateway: ## Open a shell in the running gateway container
	$(COMPOSE) exec gateway /bin/bash

shell-db: ## Open a psql shell against the running postgres container
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-todotak} -d $${POSTGRES_DB:-todotak}
TODOTAK_EOF

echo '==> Writing README.md'
cat > "README.md" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing docker-compose.override.yml'
cat > "docker-compose.override.yml" << 'TODOTAK_EOF'
# Auto-loaded by `docker compose up` whenever no explicit -f flags are
# given (that's the whole mechanism here — see the comment at the top
# of docker-compose.yml). Adds direct host access to everything for
# local development and debugging: hit a service's own /docs without
# going through the gateway, connect a GUI to Postgres, etc.
#
# Never referenced in production — `docker compose -f docker-compose.yml
# -f docker-compose.prod.yml up -d` does not pick this file up.

services:
  postgres:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"

  auth-service:
    ports:
      - "8001:8000"

  core-service:
    ports:
      - "8002:8000"

  ai-service:
    ports:
      - "8003:8000"

  notification-service:
    ports:
      - "8004:8000"

  blackbox-exporter:
    ports:
      - "9115:9115"

  prometheus:
    ports:
      - "9090:9090"

  grafana:
    ports:
      - "3001:3000"
TODOTAK_EOF

echo '==> Writing docker-compose.prod.yml'
cat > "docker-compose.prod.yml" << 'TODOTAK_EOF'
# Production overrides, purely additive by design (see the note at
# the top of docker-compose.yml about why: Compose merges list fields
# like `ports` across files rather than letting an override replace
# them, so this file only ever adds things — restart policies,
# resource limits, log rotation, TLS — never tries to remove a port
# the base file didn't already withhold).
#
# Apply with:
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

x-prod-defaults: &prod-defaults
  restart: always
  logging:
    driver: json-file
    options:
      max-size: "10m"
      max-file: "3"

services:
  blackbox-exporter:
    <<: *prod-defaults

  postgres:
    <<: *prod-defaults
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G

  redis:
    <<: *prod-defaults
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  auth-service:
    <<: *prod-defaults
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  core-service:
    <<: *prod-defaults
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  ai-service:
    <<: *prod-defaults
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  notification-service:
    <<: *prod-defaults
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  notification-worker:
    <<: *prod-defaults
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  gateway:
    <<: *prod-defaults
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  frontend:
    <<: *prod-defaults
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  nginx:
    <<: *prod-defaults
    # NOTE: TLS termination is intentionally not configured here.
    # infra/nginx/nginx.conf only defines a port-80 HTTP server block.
    # For production HTTPS, either terminate TLS upstream of this
    # container (a managed load balancer / Cloudflare / etc. — the
    # common real-world choice), or extend nginx.conf with an
    # `listen 443 ssl;` server block plus a certificate (e.g. via
    # certbot) and add the corresponding port mapping and volume
    # mount here once that config actually exists.

  prometheus:
    <<: *prod-defaults
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  grafana:
    <<: *prod-defaults
TODOTAK_EOF

echo '==> Writing docker-compose.yml'
cat > "docker-compose.yml" << 'TODOTAK_EOF'
# Base compose file. Secure-by-default: only the gateway, frontend,
# and nginx publish ports to the host. Everything else (databases,
# individual backend services, monitoring UIs) is reachable only on
# the internal docker network from this file alone.
#
#   Local development (recommended): `docker compose up`
#     Compose auto-loads docker-compose.override.yml alongside this
#     file, which adds convenience host ports for direct access to
#     each service, Postgres, Redis, Prometheus, and Grafana.
#
#   Production: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
#     Passing explicit -f flags means docker-compose.override.yml is
#     NOT included, so none of those dev-only ports are ever exposed.
#
# (Compose merges list fields like `ports` additively across files —
# there is no way to "remove" a port via an override — which is why
# the split is structured this way rather than trying to strip ports
# back out in docker-compose.prod.yml.)

x-service-defaults: &service-defaults
  restart: unless-stopped
  networks:
    - todotak-network

services:
  # ---------------------------------------------------------------------
  # Data stores
  # ---------------------------------------------------------------------
  postgres:
    <<: *service-defaults
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-todotak}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-todotak}
      POSTGRES_DB: ${POSTGRES_DB:-todotak}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-todotak}"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    <<: *service-defaults
    image: redis:7-alpine
    command: ["redis-server", "/usr/local/etc/redis/redis.conf"]
    volumes:
      - redis_data:/data
      - ./infra/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  # ---------------------------------------------------------------------
  # Application services
  # ---------------------------------------------------------------------
  auth-service:
    <<: *service-defaults
    build:
      context: ./auth-service
    environment:
      ENVIRONMENT: ${ENVIRONMENT:-development}
      DEBUG: ${DEBUG:-true}
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-todotak}:${POSTGRES_PASSWORD:-todotak}@postgres:5432/${POSTGRES_DB:-todotak}
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: ${JWT_ALGORITHM:-HS256}
      ACCESS_TOKEN_EXPIRE_MINUTES: ${ACCESS_TOKEN_EXPIRE_MINUTES:-15}
      REFRESH_TOKEN_EXPIRE_DAYS: ${REFRESH_TOKEN_EXPIRE_DAYS:-30}
      INTERNAL_SERVICE_API_KEY: ${INTERNAL_SERVICE_API_KEY}
      CORS_ORIGINS: ${CORS_ORIGINS:-["http://localhost:3000"]}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  core-service:
    <<: *service-defaults
    build:
      context: ./core-service
    environment:
      ENVIRONMENT: ${ENVIRONMENT:-development}
      DEBUG: ${DEBUG:-true}
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-todotak}:${POSTGRES_PASSWORD:-todotak}@postgres:5432/${POSTGRES_DB:-todotak}
      REDIS_URL: redis://redis:6379/1
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: ${JWT_ALGORITHM:-HS256}
      INTERNAL_SERVICE_API_KEY: ${INTERNAL_SERVICE_API_KEY}
      NOTIFICATION_SERVICE_URL: http://notification-service:8000
      CORS_ORIGINS: ${CORS_ORIGINS:-["http://localhost:3000"]}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  ai-service:
    <<: *service-defaults
    build:
      context: ./ai-service
    environment:
      ENVIRONMENT: ${ENVIRONMENT:-development}
      DEBUG: ${DEBUG:-true}
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-todotak}:${POSTGRES_PASSWORD:-todotak}@postgres:5432/${POSTGRES_DB:-todotak}
      REDIS_URL: redis://redis:6379/2
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: ${JWT_ALGORITHM:-HS256}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_MODEL: ${OPENAI_MODEL:-gpt-4o}
      CORE_SERVICE_URL: http://core-service:8000
      CORS_ORIGINS: ${CORS_ORIGINS:-["http://localhost:3000"]}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      core-service:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  notification-service:
    <<: *service-defaults
    build:
      context: ./notification-service
    environment:
      ENVIRONMENT: ${ENVIRONMENT:-development}
      DEBUG: ${DEBUG:-true}
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-todotak}:${POSTGRES_PASSWORD:-todotak}@postgres:5432/${POSTGRES_DB:-todotak}
      REDIS_URL: redis://redis:6379/3
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: ${JWT_ALGORITHM:-HS256}
      INTERNAL_SERVICE_API_KEY: ${INTERNAL_SERVICE_API_KEY}
      AUTH_SERVICE_URL: http://auth-service:8000
      SMTP_HOST: ${SMTP_HOST:-localhost}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USERNAME: ${SMTP_USERNAME:-}
      SMTP_PASSWORD: ${SMTP_PASSWORD:-}
      SMTP_USE_TLS: ${SMTP_USE_TLS:-true}
      SMTP_FROM_EMAIL: ${SMTP_FROM_EMAIL:-no-reply@todotak.app}
      CORS_ORIGINS: ${CORS_ORIGINS:-["http://localhost:3000"]}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      auth-service:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  notification-worker:
    <<: *service-defaults
    build:
      context: ./notification-service
    command: ["python", "-m", "app.workers.run"]
    environment:
      ENVIRONMENT: ${ENVIRONMENT:-development}
      DEBUG: ${DEBUG:-true}
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-todotak}:${POSTGRES_PASSWORD:-todotak}@postgres:5432/${POSTGRES_DB:-todotak}
      REDIS_URL: redis://redis:6379/3
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: ${JWT_ALGORITHM:-HS256}
      INTERNAL_SERVICE_API_KEY: ${INTERNAL_SERVICE_API_KEY}
      AUTH_SERVICE_URL: http://auth-service:8000
      SMTP_HOST: ${SMTP_HOST:-localhost}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USERNAME: ${SMTP_USERNAME:-}
      SMTP_PASSWORD: ${SMTP_PASSWORD:-}
      SMTP_USE_TLS: ${SMTP_USE_TLS:-true}
      SMTP_FROM_EMAIL: ${SMTP_FROM_EMAIL:-no-reply@todotak.app}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      notification-service:
        condition: service_started

  gateway:
    <<: *service-defaults
    build:
      context: ./gateway
    environment:
      ENVIRONMENT: ${ENVIRONMENT:-development}
      DEBUG: ${DEBUG:-true}
      AUTH_SERVICE_URL: http://auth-service:8000
      CORE_SERVICE_URL: http://core-service:8000
      AI_SERVICE_URL: http://ai-service:8000
      NOTIFICATION_SERVICE_URL: http://notification-service:8000
      REDIS_URL: redis://redis:6379/4
      RATE_LIMIT_REQUESTS: ${RATE_LIMIT_REQUESTS:-100}
      RATE_LIMIT_WINDOW_SECONDS: ${RATE_LIMIT_WINDOW_SECONDS:-60}
      CORS_ORIGINS: ${CORS_ORIGINS:-["http://localhost:3000"]}
    ports:
      - "8000:8000"
    depends_on:
      redis:
        condition: service_healthy
      auth-service:
        condition: service_started
      core-service:
        condition: service_started
      ai-service:
        condition: service_started
      notification-service:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # ---------------------------------------------------------------------
  # Frontend
  # ---------------------------------------------------------------------
  frontend:
    <<: *service-defaults
    build:
      context: ./frontend
    environment:
      NEXT_PUBLIC_API_BASE_URL: /api/gateway
      NEXT_PUBLIC_GATEWAY_URL: http://gateway:8000
    ports:
      - "3000:3000"
    depends_on:
      gateway:
        condition: service_healthy

  # ---------------------------------------------------------------------
  # Edge proxy
  # ---------------------------------------------------------------------
  nginx:
    <<: *service-defaults
    image: nginx:1.27-alpine
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
    depends_on:
      - frontend
      - gateway

  # ---------------------------------------------------------------------
  # Monitoring
  # ---------------------------------------------------------------------
  blackbox-exporter:
    <<: *service-defaults
    image: prom/blackbox-exporter:v0.25.0
    volumes:
      - ./monitoring/prometheus/blackbox.yml:/etc/blackbox_exporter/config.yml:ro

  prometheus:
    <<: *service-defaults
    image: prom/prometheus:v2.55.1
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./infra/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus
    depends_on:
      - blackbox-exporter

  grafana:
    <<: *service-defaults
    image: grafana/grafana:11.2.2
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
    volumes:
      - ./infra/grafana/grafana.ini:/etc/grafana/grafana.ini:ro
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

networks:
  todotak-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
TODOTAK_EOF

echo '==> Writing infra/docker/run-migrations.sh'
cat > "infra/docker/run-migrations.sh" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing infra/grafana/grafana.ini'
cat > "infra/grafana/grafana.ini" << 'TODOTAK_EOF'
[server]
protocol = http
http_port = 3000
root_url = %(protocol)s://%(domain)s:%(http_port)s/

[security]
# Actual admin credentials come from GF_SECURITY_ADMIN_USER /
# GF_SECURITY_ADMIN_PASSWORD environment variables set in
# docker-compose.yml (from the root .env file) — these are just
# fallback defaults if those env vars are somehow unset.
admin_user = admin
admin_password = admin
cookie_secure = false

[users]
allow_sign_up = false
default_theme = dark

[auth.anonymous]
enabled = false

[analytics]
reporting_enabled = false
check_for_updates = false

[log]
mode = console
level = info

[dashboards]
default_home_dashboard_path = /var/lib/grafana/dashboards/todotak-overview.json
TODOTAK_EOF

echo '==> Writing infra/nginx/nginx.conf'
cat > "infra/nginx/nginx.conf" << 'TODOTAK_EOF'
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    tcp_nopush      on;
    keepalive_timeout  65;
    client_max_body_size 10m;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1024;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                     '$status $body_bytes_sent "$http_referer" '
                     '"$http_user_agent" rt=$request_time';
    access_log /dev/stdout main;
    error_log  /dev/stderr warn;

    # Coarse edge-level rate limiting, on top of (not instead of) the
    # gateway's own Redis-backed per-client limiter. This one exists to
    # blunt obvious abuse before it even reaches the app tier.
    limit_req_zone $binary_remote_addr zone=edge_limit:10m rate=20r/s;

    upstream frontend_upstream {
        server frontend:3000;
    }

    upstream gateway_upstream {
        server gateway:8000;
    }

    server {
        listen 80;
        server_name _;

        limit_req zone=edge_limit burst=40 nodelay;

        # API traffic goes straight to the gateway, bypassing the
        # Next.js server entirely. The frontend's own rewrite in
        # next.config.js targets the same path prefix and is only
        # exercised when running the frontend without nginx in front
        # (e.g. `npm run dev` locally).
        location /api/gateway/ {
            proxy_pass http://gateway_upstream/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 5s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        location / {
            proxy_pass http://frontend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            # Next.js dev/HMR and any future websocket use.
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_connect_timeout 5s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }
    }
}
TODOTAK_EOF

echo '==> Writing infra/postgres/init.sql'
cat > "infra/postgres/init.sql" << 'TODOTAK_EOF'
-- Runs once, automatically, the first time the postgres container
-- initializes an empty data directory (via docker-entrypoint-initdb.d).
--
-- Each service's own Alembic migration already does
-- `CREATE SCHEMA IF NOT EXISTS <schema>`, so this isn't strictly
-- required — but having the schemas exist up front means any
-- tooling that inspects the database before migrations have run
-- (e.g. a health check, or `psql -c '\dn'`) sees the expected shape
-- immediately.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS notification;

COMMENT ON SCHEMA auth IS 'Owned by auth-service: users, refresh_tokens, password_reset_tokens.';
COMMENT ON SCHEMA core IS 'Owned by core-service: tasks, task_tags, meetings, meeting_participants, reminders.';
COMMENT ON SCHEMA ai IS 'Owned by ai-service: conversations, messages, tool_call_logs.';
COMMENT ON SCHEMA notification IS 'Owned by notification-service: notifications, notification_preferences.';
TODOTAK_EOF

echo '==> Writing infra/prometheus/alerts.yml'
cat > "infra/prometheus/alerts.yml" << 'TODOTAK_EOF'
groups:
  - name: todotak-service-health
    rules:
      - alert: ServiceDown
        expr: probe_success == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.instance }} is down"
          description: "The health check probe for {{ $labels.instance }} has been failing for more than 1 minute."

      - alert: ServiceSlowHealthCheck
        expr: probe_duration_seconds > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.instance }} health check is slow"
          description: "The health check for {{ $labels.instance }} has taken longer than 2s for 5 minutes straight."

      - alert: PrometheusTargetMissing
        expr: up == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Prometheus target {{ $labels.job }} is missing"
          description: "{{ $labels.instance }} has not been scraped successfully for 5 minutes."
TODOTAK_EOF

echo '==> Writing infra/redis/redis.conf'
cat > "infra/redis/redis.conf" << 'TODOTAK_EOF'
# Redis config for the Todotak stack. Mounted read-only into the
# redis container by docker-compose.
#
# Redis here serves three purposes across services: the gateway's
# rate-limit counters (db 4), and notification-service's dispatch
# queue (db 3) which must survive a restart without losing queued
# notification ids, plus general caching room for future use (dbs 0-2
# reserved per-service by convention, see docker-compose.yml).

bind 0.0.0.0
protected-mode no
port 6379

databases 16

# Persistence: AOF gives us at-most-one-second of durability loss,
# which matters for the notification queue — losing queued
# notification ids silently would mean reminders never fire.
appendonly yes
appendfsync everysec

# Fall back to RDB snapshots too, useful for backups / fast restarts.
save 900 1
save 300 10
save 60 10000

# Don't evict queue/rate-limit keys under memory pressure; fail writes
# instead so the problem is visible rather than silently dropping data.
maxmemory 256mb
maxmemory-policy noeviction

# NOTE: this is intentionally unauthenticated (no requirepass) since
# Redis is only reachable on the internal docker network in this
# setup. If Redis is ever exposed beyond that network, add
# `requirepass` here and update REDIS_URL in every service's
# environment to include the password.
TODOTAK_EOF

echo '==> Writing monitoring/grafana/dashboards/todotak-overview.json'
cat > "monitoring/grafana/dashboards/todotak-overview.json" << 'TODOTAK_EOF'
{
  "title": "Todotak - Service Health",
  "uid": "todotak-overview",
  "schemaVersion": 39,
  "version": 1,
  "editable": true,
  "timezone": "browser",
  "time": { "from": "now-6h", "to": "now" },
  "refresh": "30s",
  "tags": ["todotak"],
  "panels": [
    {
      "id": 1,
      "title": "Service status",
      "type": "stat",
      "gridPos": { "h": 6, "w": 24, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "Prometheus" },
      "targets": [
        {
          "expr": "probe_success",
          "legendFormat": "{{instance}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "mappings": [
            { "type": "value", "options": { "0": { "text": "DOWN", "color": "red" } } },
            { "type": "value", "options": { "1": { "text": "UP", "color": "green" } } }
          ],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "red", "value": null },
              { "color": "green", "value": 1 }
            ]
          }
        },
        "overrides": []
      },
      "options": {
        "colorMode": "background",
        "graphMode": "none",
        "textMode": "value_and_name",
        "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false }
      }
    },
    {
      "id": 2,
      "title": "Health check latency",
      "type": "timeseries",
      "gridPos": { "h": 9, "w": 24, "x": 0, "y": 6 },
      "datasource": { "type": "prometheus", "uid": "Prometheus" },
      "targets": [
        {
          "expr": "probe_duration_seconds",
          "legendFormat": "{{instance}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 10 }
        },
        "overrides": []
      }
    },
    {
      "id": 3,
      "title": "Scrape targets up",
      "type": "timeseries",
      "gridPos": { "h": 9, "w": 24, "x": 0, "y": 15 },
      "datasource": { "type": "prometheus", "uid": "Prometheus" },
      "targets": [
        {
          "expr": "up",
          "legendFormat": "{{job}} - {{instance}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 10 },
          "min": 0,
          "max": 1
        },
        "overrides": []
      }
    }
  ]
}
TODOTAK_EOF

echo '==> Writing monitoring/grafana/provisioning/dashboards/dashboard.yml'
cat > "monitoring/grafana/provisioning/dashboards/dashboard.yml" << 'TODOTAK_EOF'
apiVersion: 1

providers:
  - name: todotak
    orgId: 1
    folder: ""
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
TODOTAK_EOF

echo '==> Writing monitoring/grafana/provisioning/datasources/datasource.yml'
cat > "monitoring/grafana/provisioning/datasources/datasource.yml" << 'TODOTAK_EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
TODOTAK_EOF

echo '==> Writing monitoring/prometheus/blackbox.yml'
cat > "monitoring/prometheus/blackbox.yml" << 'TODOTAK_EOF'
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: [200]
      method: GET
      follow_redirects: true
      preferred_ip_protocol: "ip4"
TODOTAK_EOF

echo '==> Writing monitoring/prometheus/prometheus.yml'
cat > "monitoring/prometheus/prometheus.yml" << 'TODOTAK_EOF'
# None of Todotak's services expose a /metrics endpoint yet, so this
# deliberately does not pretend to scrape one. What actually exists on
# every service is a /health endpoint, so Prometheus monitors uptime
# and latency for those via the blackbox exporter's http_2xx probe.
# If/when a service adds real Prometheus instrumentation
# (prometheus-fastapi-instrumentator or similar), add a direct
# scrape_config job for it here rather than routing it through
# blackbox.

global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/alerts.yml

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: todotak-services
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - http://auth-service:8000/health
          - http://core-service:8000/health
          - http://ai-service:8000/health
          - http://notification-service:8000/health
          - http://gateway:8000/health
        labels:
          tier: backend
      - targets:
          - http://frontend:3000/
        labels:
          tier: frontend
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115

  - job_name: blackbox-exporter
    static_configs:
      - targets: ["blackbox-exporter:9115"]
TODOTAK_EOF

echo '==> Writing pyproject.toml'
cat > "pyproject.toml" << 'TODOTAK_EOF'
[tool.ruff]
line-length = 88
target-version = "py312"
extend-exclude = [
    "*/alembic/versions/*",
    "frontend",
    "node_modules",
]

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "UP",  # pyupgrade
    "C4",  # flake8-comprehensions
    "ASYNC", # flake8-async (blocking calls in async functions, etc.)
]
ignore = [
    "B008", # function calls in argument defaults (standard FastAPI Depends() pattern)
]

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"

[tool.pytest.ini_options]
asyncio_mode = "strict"
testpaths = ["tests"]
TODOTAK_EOF

chmod +x infra/docker/run-migrations.sh

echo '==> infra files written successfully'
echo 'Next steps:'
echo '  1. cp .env.example .env'
echo '     Set JWT_SECRET_KEY, INTERNAL_SERVICE_API_KEY, and OPENAI_API_KEY'
echo '     (INTERNAL_SERVICE_API_KEY must match what you put in each services .env if running them standalone too)'
echo '  2. make up          # builds and starts the full stack'
echo '  3. make migrate     # runs Alembic migrations for all 4 services with a DB'
echo '  4. Visit http://localhost:3000'
echo ''
echo 'Run `make help` for the full list of commands.'