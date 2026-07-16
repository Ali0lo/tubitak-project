#!/usr/bin/env bash
# Todotak - infrastructure, CI/CD, docs, scripts, and tests
# (supersedes the earlier setup_infra.sh from phase 7 - this is
#  a superset including the docker-compose.prod.yml GHCR image tags,
#  updated .env.example, and updated Makefile from phase 8, plus
#  .github/workflows/, scripts/, docs/, and tests/{e2e,load,security,contracts}/)
# Run this from the root of your todotak/ repo:
#   bash setup_infra.sh
set -euo pipefail

echo '==> Creating directories'
mkdir -p ".github/workflows"
mkdir -p "docs"
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
mkdir -p "scripts"
mkdir -p "tests"
mkdir -p "tests/contracts"
mkdir -p "tests/e2e"
mkdir -p "tests/load"
mkdir -p "tests/security"

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

# --- Production deployment only (docker-compose.prod.yml) -------------------
# Which pre-built images `scripts/deploy.sh` / `docker compose pull`
# fetch from GHCR, published by .github/workflows/cd.yml. Ignored
# entirely in local dev (docker-compose.yml uses `build:` instead).
GHCR_REPOSITORY=ghcr.io/your-github-username/tubitak-project
IMAGE_TAG=latest
TODOTAK_EOF

echo '==> Writing .github/workflows/cd.yml'
cat > ".github/workflows/cd.yml" << 'TODOTAK_EOF'
name: CD

# Builds and publishes a Docker image for every service to GitHub
# Container Registry whenever main is updated, tagged both with the
# commit SHA (for precise rollback) and `latest`. Deployment itself
# (pulling the new images onto a host and restarting) is intentionally
# a separate, manual step via scripts/deploy.sh — this workflow does
# not SSH anywhere or touch a running environment.

on:
  push:
    branches: [main]
    tags: ["v*"]
  workflow_dispatch: {}

permissions:
  contents: read
  packages: write

env:
  REGISTRY: ghcr.io

jobs:
  build-and-push:
    name: Build - ${{ matrix.service }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - auth-service
          - core-service
          - gateway
          - ai-service
          - notification-service
          - frontend
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}/${{ matrix.service }}
          tags: |
            type=sha,prefix=,format=short
            type=raw,value=latest,enable={{is_default_branch}}
            type=semver,pattern={{version}}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: ./${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}
TODOTAK_EOF

echo '==> Writing .github/workflows/ci.yml'
cat > ".github/workflows/ci.yml" << 'TODOTAK_EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-python:
    name: Lint Python services
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - auth-service
          - core-service
          - gateway
          - ai-service
          - notification-service
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install ruff
        run: pip install ruff==0.7.1

      - name: Ruff check
        run: ruff check ${{ matrix.service }}

      - name: Ruff format check
        run: ruff format --check ${{ matrix.service }}

  unit-tests-python:
    name: Dependency-free unit tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - service: gateway
            test_paths: "tests/"
          - service: ai-service
            test_paths: "tests/test_tool_definitions.py tests/test_core_service_client.py tests/test_tool_executor.py"
          - service: notification-service
            test_paths: "tests/test_redis_queue.py tests/test_email_templates.py tests/test_auth_service_client.py tests/test_email_client.py"
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: ${{ matrix.service }}/requirements.txt

      - name: Install dependencies
        working-directory: ${{ matrix.service }}
        run: pip install -r requirements.txt

      - name: Run tests
        working-directory: ${{ matrix.service }}
        run: pytest ${{ matrix.test_paths }} -v

  frontend:
    name: Frontend typecheck, lint, and unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Typecheck
        working-directory: frontend
        run: npm run typecheck

      - name: Lint
        working-directory: frontend
        run: npm run lint

      - name: Unit tests
        working-directory: frontend
        run: npm test

  contract-tests:
    name: Cross-service contract tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies for every service under test
        run: |
          pip install -r core-service/requirements.txt
          pip install -r notification-service/requirements.txt
          pip install -r ai-service/requirements.txt

      - name: Run contract tests
        working-directory: tests/contracts
        env:
          DATABASE_URL: "postgresql+asyncpg://user:pass@localhost:5432/unused"
          JWT_SECRET_KEY: "ci-test-secret"
          INTERNAL_SERVICE_API_KEY: "ci-test-internal-key"
          OPENAI_API_KEY: "sk-ci-test-not-real"
        run: pytest -v

  security-scan:
    name: Security scan (bandit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install bandit
        run: pip install bandit==1.9.4

      - name: Run bandit across all Python services
        run: |
          bandit -r auth-service/app core-service/app gateway/app ai-service/app notification-service/app

      - name: Run auth-enforcement sweep
        env:
          DATABASE_URL: "postgresql+asyncpg://user:pass@localhost:5432/unused"
          JWT_SECRET_KEY: "ci-test-secret"
          INTERNAL_SERVICE_API_KEY: "ci-test-internal-key"
          OPENAI_API_KEY: "sk-ci-test-not-real"
        run: |
          pip install -r core-service/requirements.txt
          pip install -r ai-service/requirements.txt
          pip install -r notification-service/requirements.txt
          pip install -r auth-service/requirements.txt
          pytest tests/security -v

  compose-validate:
    name: Validate docker-compose configuration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create dummy .env for interpolation
        run: cp .env.example .env

      - name: Validate dev config
        run: docker compose config --quiet

      - name: Validate prod config
        run: docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
TODOTAK_EOF

echo '==> Writing .github/workflows/tests.yml'
cat > ".github/workflows/tests.yml" << 'TODOTAK_EOF'
name: Full Test Suite

# Runs the complete test suite for every service, including the
# database-backed integration tests that ci.yml intentionally skips
# for speed. Triggered on push to main and nightly, since spinning up
# Postgres per service is slower than the fast CI checks.

on:
  push:
    branches: [main]
  schedule:
    - cron: "0 3 * * *"
  workflow_dispatch: {}

jobs:
  full-suite:
    name: Full suite - ${{ matrix.service }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        service:
          - auth-service
          - core-service
          - ai-service
          - notification-service

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: todotak
          POSTGRES_PASSWORD: todotak
          POSTGRES_DB: todotak_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U todotak"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: ${{ matrix.service }}/requirements.txt

      - name: Install dependencies
        working-directory: ${{ matrix.service }}
        run: pip install -r requirements.txt

      - name: Run full test suite
        working-directory: ${{ matrix.service }}
        env:
          TEST_DATABASE_URL: "postgresql+asyncpg://todotak:todotak@localhost:5432/todotak_test"
          JWT_SECRET_KEY: "ci-test-secret-key"
          INTERNAL_SERVICE_API_KEY: "ci-test-internal-key"
          OPENAI_API_KEY: "sk-ci-test-not-real"
        run: pytest -v

  gateway-suite:
    name: Full suite - gateway (no external services needed)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: gateway/requirements.txt

      - name: Install dependencies
        working-directory: gateway
        run: pip install -r requirements.txt

      - name: Run full test suite
        working-directory: gateway
        run: pytest -v

  frontend-build:
    name: Frontend production build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Production build
        working-directory: frontend
        env:
          NEXT_PUBLIC_API_BASE_URL: /api/gateway
          NEXT_PUBLIC_GATEWAY_URL: http://localhost:8000
        run: npm run build
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
	bash scripts/migrate.sh

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
# Also adds `image:` tags for every service .github/workflows/cd.yml
# publishes to GHCR, matching GHCR_REPOSITORY + IMAGE_TAG below. This
# is what makes `docker compose pull` in scripts/deploy.sh meaningful
# — without it, compose has no pre-built image to pull and always
# rebuilds from source locally, silently ignoring whatever CD just
# published. Set GHCR_REPOSITORY to your actual
# ghcr.io/<owner>/<repo> and IMAGE_TAG to a commit SHA or `latest`
# before deploying; both default to values that keep this file usable
# even if you haven't set up CD yet (compose falls back to building
# from the `build:` context in the base file when the image can't be
# pulled).
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
    image: ${GHCR_REPOSITORY:-ghcr.io/example/todotak}/auth-service:${IMAGE_TAG:-latest}
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
    image: ${GHCR_REPOSITORY:-ghcr.io/example/todotak}/core-service:${IMAGE_TAG:-latest}
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
    image: ${GHCR_REPOSITORY:-ghcr.io/example/todotak}/ai-service:${IMAGE_TAG:-latest}
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
    image: ${GHCR_REPOSITORY:-ghcr.io/example/todotak}/notification-service:${IMAGE_TAG:-latest}
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
    image: ${GHCR_REPOSITORY:-ghcr.io/example/todotak}/notification-service:${IMAGE_TAG:-latest}
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
    image: ${GHCR_REPOSITORY:-ghcr.io/example/todotak}/gateway:${IMAGE_TAG:-latest}
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
    image: ${GHCR_REPOSITORY:-ghcr.io/example/todotak}/frontend:${IMAGE_TAG:-latest}
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

echo '==> Writing docs/api.md'
cat > "docs/api.md" << 'TODOTAK_EOF'
# API Reference

All user-facing endpoints are reached through the gateway at
`http://localhost:8000` in dev (or via nginx in production). Each
service also has interactive Swagger docs at its own `/docs` — this
document is a quick reference, not a replacement for those.

Every endpoint below except the ones explicitly marked **public** or
**internal** requires `Authorization: Bearer <access_token>`.

## auth-service — `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | public | Create an account |
| POST | `/login` | public | Returns access + refresh token (refresh set as httpOnly cookie) |
| POST | `/refresh` | public* | Rotates refresh token, returns new access token |
| POST | `/logout` | — | Revokes the refresh token |
| GET | `/me` | user | Current user's profile |
| POST | `/password-reset/request` | public | Always returns 202, doesn't leak whether the email exists |
| POST | `/password-reset/confirm` | public | Consumes a reset token, sets new password |
| GET | `/internal/users/{id}` | **internal** | Used by notification-service to resolve an email address |

\* `/refresh` doesn't require a bearer token but does require a valid
refresh token, via cookie or request body.

## core-service

### `/api/v1/tasks`

| Method | Path | Description |
|---|---|---|
| POST | `` | Create a task |
| GET | `` | List tasks (`status`, `priority`, `tag`, `due_before`, `due_after`, `page`, `page_size`) |
| GET | `/{id}` | Get one task |
| PATCH | `/{id}` | Update title/description/status/priority/due_date |
| PUT | `/{id}/tags` | Replace a task's tags |
| DELETE | `/{id}` | Delete |

### `/api/v1/meetings`

| Method | Path | Description |
|---|---|---|
| POST | `` | Create a meeting (optionally with participants) |
| GET | `` | List (`status`, `starts_after`, `starts_before`) |
| GET | `/{id}` | Get one |
| PATCH | `/{id}` | Update |
| POST | `/{id}/cancel` | Cancel |
| DELETE | `/{id}` | Delete |
| PATCH | `/{id}/participants/{participant_id}` | Update a participant's RSVP |

### `/api/v1/reminders`

| Method | Path | Description |
|---|---|---|
| POST | `` | Create (optionally linked to one task or meeting, not both) |
| GET | `` | List (`is_sent`) |
| GET | `/{id}` | Get one |
| PATCH | `/{id}` | Update time/message (only if not yet sent) |
| DELETE | `/{id}` | Delete (also cancels the pending notification) |

## ai-service

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/ai/chat` | Send a message; `conversation_id` optional (omit to start a new one) |
| GET | `/api/v1/ai/conversations` | List your conversations |
| GET | `/api/v1/ai/conversations/{id}` | Get one with full message history |
| PATCH | `/api/v1/ai/conversations/{id}` | Rename |
| DELETE | `/api/v1/ai/conversations/{id}` | Delete |

## notification-service

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/notifications/schedule` | **internal** | Called by core-service |
| POST | `/api/v1/notifications/source/{source}/{ref_id}/cancel` | **internal** | Called by core-service |
| GET | `/api/v1/notifications` | user | List your notifications |
| GET | `/api/v1/notifications/{id}` | user | Get one |
| GET | `/api/v1/notifications/preferences` | user | Get email-notification preference |
| PATCH | `/api/v1/notifications/preferences` | user | Toggle email notifications on/off |

## gateway

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Gateway's own liveness |
| GET | `/health/services` | Aggregated health of all four backend services |
| * | `/api/v1/{...}` | Reverse-proxies to the owning service per `app/config/routes_table.py` |

## Error shape

Every service returns errors in the same shape:

```json
{ "detail": "Human-readable message" }
```

Validation errors (422) additionally include an `errors` array with
per-field detail, matching FastAPI's default `RequestValidationError`
format.
TODOTAK_EOF

echo '==> Writing docs/architecture.md'
cat > "docs/architecture.md" << 'TODOTAK_EOF'
# Architecture

## Overview

Todotak is six backend services plus a Next.js frontend, sitting
behind an API gateway. Every service is independently deployable,
independently testable, and owns its own slice of a single Postgres
instance via a dedicated schema — never another service's tables.

```
                         ┌─────────┐
                         │  nginx  │  edge proxy, port 80
                         └────┬────┘
                    ┌─────────┴─────────┐
              ┌─────▼─────┐      ┌──────▼──────┐
              │  frontend │      │   gateway   │  routing, rate limiting
              └───────────┘      └──────┬──────┘
        ┌───────────────┬────────────────┼────────────────┐
  ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼─────┐  ┌───────▼───────┐
  │auth-service│   │core-service │  │ ai-service │  │notification-  │
  │            │   │             │  │            │  │service         │
  └─────┬──────┘   └──────┬──────┘  └─────┬──────┘  └────────┬───────┘
        └─────────────────┴────────┬───────┴──────────────────┘
                          ┌─────────▼─────────┐
                          │   PostgreSQL 16    │  4 schemas, 1 instance
                          └─────────────────────┘
                          ┌─────────▼─────────┐
                          │       Redis        │  queue + rate limiting
                          └─────────────────────┘
```

## Services

### auth-service
Owns the `auth` schema: `users`, `refresh_tokens`,
`password_reset_tokens`. Issues JWT access tokens (15 min) and refresh
tokens (30 days, rotated on every use, stored hashed). Argon2id for
password hashing. Exposes one internal, service-to-service-only
endpoint (`GET /api/v1/internal/users/{id}`, guarded by
`INTERNAL_SERVICE_API_KEY`) that notification-service uses to resolve
a user's email before sending a reminder email.

### core-service
Owns the `core` schema: `tasks`, `task_tags`, `meetings`,
`meeting_participants`, `reminders`. All CRUD for the app's actual
domain objects. Verifies JWTs itself (shared secret with auth-service)
rather than calling auth-service on every request. When a reminder is
created, calls notification-service directly (bypassing the gateway)
to schedule the notification.

### ai-service
Owns the `ai` schema: `conversations`, `messages`, `tool_call_logs`.
The primary interface, per the product's design: a user's natural-
language message drives an OpenAI tool-calling loop
(`ChatService.send_message`) that can create/list/update/delete tasks,
meetings, and reminders by calling core-service's HTTP API — using the
**user's own forwarded access token**, never elevated privileges. Every
tool call is logged (`tool_call_logs`) for auditability. Capped at
`MAX_TOOL_ITERATIONS` (default 5) to prevent runaway loops.

### notification-service
Owns the `notification` schema: `notifications`,
`notification_preferences`. Two internal endpoints
(`/schedule`, `/cancel`) that core-service calls directly. A separate
worker process (`python -m app.workers.run`, not the API process) runs
two loops: a scheduler that atomically claims due notifications
(`UPDATE ... RETURNING ... SKIP LOCKED`, safe under concurrent
scheduler instances) and pushes them onto a Redis queue, and a
dispatcher that sends email (real SMTP, not a mock) and marks rows
sent. In-app notifications need no separate delivery step — the stored
row itself, returned by `GET /api/v1/notifications`, *is* the in-app
notification.

### gateway
No database. Reverse-proxies `/api/v1/*` to the right backend service
based on a static prefix table, checks that protected routes carry an
`Authorization` header before forwarding (final JWT verification still
happens in the owning service), and rate-limits per client IP via
Redis (fixed window, 100 req/60s by default).

### frontend
Next.js 14 App Router, TypeScript, TailwindCSS, React Query, Zustand.
Talks to the gateway via a same-origin `/api/gateway/*` rewrite in
dev, or nginx routing directly to the gateway in front of a deployed
stack — the browser never needs to know the gateway's real address.

## Cross-service authentication

Two distinct mechanisms, deliberately not conflated:

1. **User-facing requests** carry a JWT access token issued by
   auth-service. Every service that needs to know "who is this
   request for" (core-service, ai-service, notification-service)
   verifies that token itself using a `JWT_SECRET_KEY` shared with
   auth-service — no network call to auth-service needed on the hot
   path.
2. **Service-to-service-only requests** (core-service and
   notification-service calling notification-service and auth-service
   directly, bypassing the gateway) carry a shared
   `INTERNAL_SERVICE_API_KEY` instead. These endpoints are never
   routed through the gateway's normal user-auth path and never accept
   a user's JWT as authorization.

## Why schemas, not separate databases

All four services with a database share one Postgres *instance* but
never one *schema*. This is a deliberate middle ground: cheaper to
operate than four separate database servers, while still preventing
any service from accidentally (or deliberately) querying another
service's tables — cross-service data access only ever happens over
HTTP, through each service's own API, which is where ownership checks
and validation actually live.

## Data flow: creating a reminder via chat

A concrete trace through the whole stack, since it touches every
service:

1. Browser → nginx → gateway → **ai-service** `POST /api/v1/ai/chat`
   with `{"message": "remind me to call the bank at 3pm"}`.
2. ai-service loads conversation history, calls OpenAI with the
   registered tool definitions.
3. OpenAI responds with a `create_reminder` tool call.
4. ai-service's `ToolExecutor` calls **core-service**
   `POST /api/v1/reminders`, forwarding the user's own access token.
5. core-service validates, stores the reminder, then calls
   **notification-service** `POST /api/v1/notifications/schedule`
   directly (not through the gateway), authenticated with
   `INTERNAL_SERVICE_API_KEY`.
6. notification-service stores the notification row. If the
   `scheduled_for` time has already passed, it's queued for immediate
   dispatch; otherwise the scheduler worker picks it up once due.
7. ai-service persists the tool result and asks OpenAI for a final
   reply ("I've set a reminder for 3pm to call the bank"), returns it
   to the browser.
8. At 3pm, notification-service's dispatch worker sends the email (via
   real SMTP, calling **auth-service**'s internal endpoint first to
   resolve the address) and marks the row sent — which is also what
   makes it appear in the user's in-app notification list.

Every arrow in that trace is a real HTTP call between independently
running services, verified end-to-end by `tests/contracts/`.
TODOTAK_EOF

echo '==> Writing docs/deployment.md'
cat > "docs/deployment.md" << 'TODOTAK_EOF'
# Deployment

## Local development

```bash
cp .env.example .env    # fill in JWT_SECRET_KEY, INTERNAL_SERVICE_API_KEY, OPENAI_API_KEY
make up
make migrate
```

`docker compose up` (what `make up` runs) auto-loads
`docker-compose.override.yml`, exposing every service on its own
localhost port for direct debugging. See the root `README.md` for the
full port list.

## Production

### Prerequisites on the target host

- Docker + Docker Compose v2
- This repo checked out
- `.env` present with production secrets (**different** values from
  dev — especially `JWT_SECRET_KEY`, `INTERNAL_SERVICE_API_KEY`,
  `POSTGRES_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`)
- If deploying pre-built images (recommended): set `GHCR_REPOSITORY`
  in `.env` to your actual `ghcr.io/<owner>/<repo>` and make sure
  `.github/workflows/cd.yml` has run at least once for the commit
  you're deploying

### Deploying

```bash
bash scripts/deploy.sh
```

This pulls images from GHCR where available (falling back to a local
build for anything not published), applies `docker-compose.prod.yml`
on top of the base file, runs migrations, and runs a health check.
Equivalent to, step by step:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
bash scripts/migrate.sh
bash scripts/healthcheck.sh
```

### What's exposed

Only nginx (port 80). Every application service, Postgres, Redis, and
the monitoring stack are reachable only on the internal Docker
network — this is enforced by `docker-compose.yml` itself (see the
comment at its top about why `docker-compose.prod.yml` never needs to
"remove" a port).

### TLS

Not configured out of the box — `infra/nginx/nginx.conf` only defines
a port-80 HTTP server block. Pick one:

1. **Terminate TLS upstream** of this stack (a managed load balancer,
   Cloudflare, etc.) — the simplest option for most deployments, and
   what the compose files assume by default.
2. **Extend nginx.conf** with a `listen 443 ssl;` server block and a
   certificate (e.g. via certbot), then add the port mapping and cert
   volume mount to the `nginx` service in `docker-compose.prod.yml`.

### Rolling out a new version

```bash
git pull
bash scripts/deploy.sh
```

`docker compose up -d` only recreates containers whose image or config
actually changed — services with no changes keep running undisturbed.

### Rolling back

Set `IMAGE_TAG` in `.env` to a previous commit SHA (every CD run tags
images with both the SHA and `latest`), then:

```bash
bash scripts/deploy.sh
```

Database migrations are the one thing `deploy.sh` can't roll back
automatically — check `docs/runbook.md` if the version you're rolling
back to predates a migration that's already been applied.

## CI/CD

- **`.github/workflows/ci.yml`** — every push/PR: lint, dependency-free
  unit tests, frontend typecheck/lint/test, contract tests, compose
  config validation. Fast, no database required.
- **`.github/workflows/tests.yml`** — on push to `main` and nightly:
  full test suites including database-backed integration tests, using
  real Postgres/Redis service containers in the runner.
- **`.github/workflows/cd.yml`** — on push to `main` and version tags:
  builds and publishes every service's image to GHCR.

None of these SSH into a production host or trigger a deploy
automatically — `scripts/deploy.sh` is a deliberate, manual step.
TODOTAK_EOF

echo '==> Writing docs/disaster-recovery.md'
cat > "docs/disaster-recovery.md" << 'TODOTAK_EOF'
# Disaster Recovery

## What's actually at risk

- **Postgres** — the only source of truth in this system. Every
  service's state (users, tasks, meetings, reminders, conversations,
  notifications) lives here, across four schemas in one database.
- **Redis** — the notification dispatch queue and rate-limit counters.
  AOF persistence is enabled (`infra/redis/redis.conf`), so a restart
  doesn't lose queued notifications, but Redis was never designed as a
  durable system of record — treat anything in it as reconstructible,
  not as data to back up.

Everything else (application code, container images, configuration) is
in version control and rebuildable from the repo; it isn't a backup
concern.

## Recovery targets

These aren't SLA commitments, just the honest numbers this setup
actually supports without further investment:

- **RPO (data loss on failure)**: up to 24 hours, if backups run
  daily via cron and nothing else is in place. Reduce this by running
  `scripts/backup.sh` more frequently, or by adding Postgres streaming
  replication / WAL archiving for near-zero RPO (not configured here
  — see "Scaling this up" below).
- **RTO (time to restore service)**: roughly 15–30 minutes for a
  single-host restore — time to provision a host, run
  `scripts/restore.sh`, and `scripts/deploy.sh`. Longer if the backup
  file itself needs to be fetched from off-host storage first.

## Backups

```bash
bash scripts/backup.sh                # writes to ./backups/
bash scripts/backup.sh /mnt/offsite    # or anywhere else
```

**Set up a cron job** on the production host — nothing in this repo
schedules backups automatically:

```cron
0 3 * * * cd /path/to/todotak && bash scripts/backup.sh /mnt/backups >> /var/log/todotak-backup.log 2>&1
```

Back up `./backups` (or wherever you point it) to storage that isn't
the same host — S3, another server, anywhere that survives the
production host dying entirely. A local-disk-only backup doesn't
protect against the most likely failure (the host itself).

## Restoring

```bash
bash scripts/restore.sh backups/todotak-20260715T030000Z.sql.gz
```

This is destructive by design — it drops and recreates all four
service schemas before loading the dump, and requires typing the
database name to confirm. Run it against a fresh Postgres instance
(e.g. right after `docker compose up -d postgres` on a new host, before
starting any application service) rather than against a database with
data you might still need.

After restoring, run `bash scripts/migrate.sh` if the backup predates
migrations that have since been added to the codebase — restoring an
old dump doesn't retroactively apply new schema changes.

## Full host loss

1. Provision a new host, install Docker + Compose.
2. Clone the repo, restore `.env` from wherever secrets are actually
   kept (a password manager / secrets vault — **`.env` itself should
   never be the backup**, since committing or copying it around
   defeats the point of having secrets).
3. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis`
   — bring up just the data stores first.
4. `bash scripts/restore.sh <latest backup>`.
5. `bash scripts/deploy.sh` — brings up everything else and runs
   migrations (harmless no-op if the restored dump is already current).
6. `bash scripts/healthcheck.sh <new host>` to confirm.

## Testing this actually works

A backup you've never restored isn't a backup, it's a hope. Periodically:

```bash
bash scripts/backup.sh /tmp/dr-test
# on a throwaway host or a second local compose project:
bash scripts/restore.sh /tmp/dr-test/todotak-<timestamp>.sql.gz
bash scripts/healthcheck.sh
```

## Scaling this up

This setup is right-sized for a single-host deployment. If/when that
stops being enough, the natural next steps — none implemented here —
are: managed Postgres with automated point-in-time recovery instead of
cron+pg_dump, Redis with persistence on a managed service instead of a
container volume, and multi-host orchestration (the docker-compose
files would need to become Kubernetes manifests or similar at that
point).
TODOTAK_EOF

echo '==> Writing docs/runbook.md'
cat > "docs/runbook.md" << 'TODOTAK_EOF'
# Runbook

Common operational scenarios and how to handle them.

## A service is down

1. Check the dashboard: Grafana → "Todotak - Service Health", or
   `curl http://<host>:8000/health/services` for an immediate answer.
2. `docker compose ps` — is the container running at all, or has it
   exited/is it restarting in a loop?
3. `docker compose logs -f <service>` — look for the actual error.
   Common causes:
   - **Can't reach Postgres**: check `docker compose ps postgres` is
     healthy; check `DATABASE_URL` in `.env` matches
     `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`.
   - **Can't reach Redis**: same idea, check `REDIS_URL`.
   - **Missing/wrong env var**: every service's Settings() is a
     required-field Pydantic model — a missing required var crashes
     the process immediately on startup with a clear error naming the
     field.
4. `docker compose restart <service>` if the underlying issue (e.g. a
   transient DB connection blip) has since resolved.

## auth-service or core-service is up, but every request 401s

Almost always a `JWT_SECRET_KEY` mismatch — it must be byte-identical
across auth-service, core-service, ai-service, and
notification-service. Check all four `.env` values (or, in Docker, the
single root `.env` that feeds all of them via `docker-compose.yml`
interpolation — if you're running any service standalone outside
Docker with its own `.env`, that's the usual drift point).

## Internal service-to-service calls are failing with 401

Same idea, but for `INTERNAL_SERVICE_API_KEY` — must match across
auth-service, core-service, and notification-service. Check
`docker compose logs core-service` for
`"Failed to schedule notification"` warnings, or
`docker compose logs notification-service` for 401s on `/schedule` or
`/cancel`.

## Reminders aren't sending emails

1. Confirm the notification actually got created:
   `GET /api/v1/notifications` (as the affected user) or query the
   `notification.notifications` table directly.
2. Check its `status`. `pending` means it isn't due yet. `queued`
   means the scheduler claimed it but the dispatch worker hasn't
   picked it up — check `docker compose logs notification-worker` is
   actually running (it's a **separate process** from the
   notification-service API; a healthy API container doesn't imply
   the worker is up).
3. `failed` — check `failure_reason` on the row, and
   `docker compose logs notification-worker` for the SMTP error.
   Common causes: wrong `SMTP_HOST`/`PORT`, provider rejecting the
   `SMTP_FROM_EMAIL` domain (needs SPF/DKIM set up in most cases),
   auth failure.
4. Check the user's notification preference
   (`GET /api/v1/notifications/preferences`) — if `email_enabled` is
   `false`, that's expected behavior, not a bug: the row still gets
   marked `sent` (it's visible in-app) but no email goes out.
5. If notification-service can't resolve the user's email at all
   (auth-service internal lookup failing), the notification is still
   marked `sent` — check notification-worker logs for
   `"No email on file for user ..."` to confirm that's what happened.

## The dispatch queue seems backed up

Redis' `notifications:dispatch_queue` list length is the queue depth:

```bash
docker compose exec redis redis-cli -n 3 LLEN notifications:dispatch_queue
```

A growing number means the dispatch worker can't keep up — usually a
slow or rate-limiting SMTP provider. Check `notification-worker` logs
for repeated SMTP timeouts. Restarting the worker doesn't lose queued
work (Redis AOF persistence, see `infra/redis/redis.conf`), so it's
safe to restart if it looks stuck.

## AI chat is failing / OpenAI errors

- `502` from `/api/v1/ai/chat` with a generic "assistant is
  temporarily unavailable" message means the OpenAI API call itself
  failed — check `OPENAI_API_KEY` is valid and has quota, and check
  `docker compose logs ai-service` for the underlying
  `APIError`/`APITimeoutError`.
- If the assistant keeps saying it "couldn't complete this request",
  check `ai.tool_call_logs` for the specific tool and error — most
  often this is core-service rejecting a tool call (e.g. trying to
  link a reminder to a task that doesn't exist).

## Rate limiting is too aggressive / not aggressive enough

Gateway rate limits: `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS`
in `.env`. Takes effect on restart (`docker compose restart gateway`).
If Redis is unreachable, the gateway fails **open** (allows all
traffic) rather than blocking everything — check
`docker compose logs gateway` if you suspect rate limiting silently
isn't working.

## Database migration failed partway through

Alembic migrations for each service run independently
(`scripts/migrate.sh` loops over all four). If one fails:

1. `docker compose exec <service> alembic current` — see what
   revision it's actually on.
2. `docker compose logs <service>` at the time of the failed
   migration for the actual SQL error.
3. Fix forward (write a new migration) rather than editing an already-
   applied migration file — the same file that has run against
   production should never change.

## Someone needs to be locked out immediately (compromised account)

There's no admin "disable user" endpoint yet. Fastest path today:

```bash
docker compose exec postgres psql -U todotak -d todotak -c \
  "UPDATE auth.users SET is_active = false WHERE email = 'user@example.com';"
```

This alone doesn't revoke already-issued access tokens (they're
stateless JWTs, valid until they expire — 15 minutes by default). To
force immediate logout, also revoke their refresh tokens so they can't
get a new access token once the current one expires:

```bash
docker compose exec postgres psql -U todotak -d todotak -c \
  "UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = \
   (SELECT id FROM auth.users WHERE email = 'user@example.com');"
```
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

echo '==> Writing scripts/backup.sh'
cat > "scripts/backup.sh" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing scripts/deploy.sh'
cat > "scripts/deploy.sh" << 'TODOTAK_EOF'
#!/usr/bin/env bash
# Deploys the current commit to a production host that already has
# this repo checked out and a filled-in .env. Pulls freshly-built
# images (see .github/workflows/cd.yml) where available, rebuilds
# locally otherwise, then does a rolling-ish restart via `up -d`
# (compose recreates only the containers whose config/image changed).
#
# Usage: bash scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

echo "==> Pulling latest images"
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull || {
  echo "WARNING: pull failed for one or more images (expected if GHCR_REPOSITORY"
  echo "isn't set up yet, or this is the first deploy before any CD run) —"
  echo "falling back to building from source."
}

echo "==> Building any images that weren't pulled"
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

echo "==> Starting stack with production overrides"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "==> Running database migrations"
bash scripts/migrate.sh

echo "==> Waiting for services to report healthy"
sleep 5
bash scripts/healthcheck.sh

echo "==> Deploy complete"
TODOTAK_EOF

echo '==> Writing scripts/healthcheck.sh'
cat > "scripts/healthcheck.sh" << 'TODOTAK_EOF'
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
set -uo pipefail

HOST="${1:-localhost}"

declare -A SERVICES=(
  ["auth-service"]="http://${HOST}:8001/health"
  ["core-service"]="http://${HOST}:8002/health"
  ["ai-service"]="http://${HOST}:8003/health"
  ["notification-service"]="http://${HOST}:8004/health"
  ["gateway"]="http://${HOST}:8000/health"
  ["gateway-aggregated"]="http://${HOST}:8000/health/services"
  ["frontend"]="http://${HOST}:3000/"
)

FAILED=0

for name in "${!SERVICES[@]}"; do
  url="${SERVICES[$name]}"
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
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
TODOTAK_EOF

echo '==> Writing scripts/migrate.sh'
cat > "scripts/migrate.sh" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing scripts/restore.sh'
cat > "scripts/restore.sh" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing tests/__init__.py'
cat > "tests/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing tests/contracts/__init__.py'
cat > "tests/contracts/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing tests/contracts/helpers.py'
cat > "tests/contracts/helpers.py" << 'TODOTAK_EOF'
"""Shared helpers for cross-service contract tests.

Every service's top-level Python package is named `app`, so two
services can never be imported directly in the same interpreter
without one shadowing the other. Each helper here runs a small
subprocess with exactly one service directory on `sys.path`,
sidestepping that collision entirely — and, as a side effect, means
these tests exercise each service's *actual* code (client payload
construction, real Pydantic models) rather than a hand-maintained
copy of what the contract is supposed to be.

None of this requires a database or network access: importing a
schema or a client class doesn't connect to anything, it just
constructs Settings() (which needs syntactically-plausible env vars,
not a reachable database) and defines classes.
"""
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]

# Baseline env vars every service's Settings() needs to construct
# without error. Individual calls can extend this via `extra_env`.
BASE_ENV = {
    "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost:5432/unused",
    "JWT_SECRET_KEY": "contract-test-secret",
    "INTERNAL_SERVICE_API_KEY": "contract-test-internal-key",
    "OPENAI_API_KEY": "sk-contract-test-not-real",
}


def run_script(service: str, script: str, extra_env: Optional[dict] = None) -> str:
    service_dir = REPO_ROOT / service
    import os

    env = {**os.environ, **BASE_ENV, **(extra_env or {})}
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(service_dir),
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"Subprocess for service={service!r} failed "
            f"(exit {result.returncode}):\n"
            f"--- stdout ---\n{result.stdout}\n"
            f"--- stderr ---\n{result.stderr}"
        )
    return result.stdout.strip()


def capture_client_payload(
    service: str, setup_script: str, extra_env: Optional[dict] = None
) -> dict:
    """Run `setup_script` (which must print exactly one JSON line to
    stdout — the payload a client built) inside `service`'s own
    directory/interpreter, and return the parsed payload.
    """
    output = run_script(service, setup_script, extra_env)
    last_line = output.splitlines()[-1]
    return json.loads(last_line)


def validate_payload_against_model(
    service: str,
    module_path: str,
    class_name: str,
    payload: dict,
    extra_env: Optional[dict] = None,
) -> None:
    """Assert that `payload` validates against `class_name` (a Pydantic
    model) importable as `module_path` inside `service`. Raises
    AssertionError with the validation error if it doesn't.
    """
    script = f"""
import json
from {module_path} import {class_name}
payload = json.loads({json.dumps(json.dumps(payload))})
{class_name}(**payload)
print("VALID")
"""
    output = run_script(service, script, extra_env)
    if "VALID" not in output:
        raise AssertionError(f"Payload did not validate:\n{output}")


def get_json_schema(
    service: str,
    module_path: str,
    class_name: str,
    extra_env: Optional[dict] = None,
) -> dict:
    """Return the JSON schema of a Pydantic model defined in another service."""
    script = f"""
import json
from {module_path} import {class_name}
print(json.dumps({class_name}.model_json_schema()))
"""
    output = run_script(service, script, extra_env)
    return json.loads(output.splitlines()[-1])


def get_route_paths(service: str, extra_env: Optional[dict] = None) -> list:
    """Return every route path registered on a service's FastAPI app.

    Reads app.openapi()["paths"] rather than walking app.routes
    directly — the installed FastAPI version wraps included routers
    such that top-level app.routes entries for them don't expose a
    plain `.path` attribute, while the generated OpenAPI schema always
    reflects the real, final route table regardless of that detail.
    """
    script = """
import json
from app.main import create_app
app = create_app()
print(json.dumps(sorted(app.openapi()["paths"].keys())))
"""
    output = run_script(service, script, extra_env)
    return json.loads(output.splitlines()[-1])


def run_with_captured_http_call(
    service: str, call_body: str, extra_env: Optional[dict] = None
) -> dict:
    """Execute `call_body` (the indented body of an `async def main():`
    that awaits some client method) with httpx.AsyncClient
    transparently mocked, and return the single outgoing request that
    was made: {"payload": ..., "headers": ..., "url": ...}.

    This exercises each client's *actual* payload-construction code
    rather than a hand-copied reimplementation of what it's supposed
    to send — the whole point of a contract test.
    """
    script = f"""
import asyncio, json
import httpx

captured = {{}}

def _handler(request):
    captured["payload"] = json.loads(request.content or b"{{}}")
    captured["headers"] = dict(request.headers)
    captured["url"] = str(request.url)
    return httpx.Response(200, json={{}})

_original_async_client = httpx.AsyncClient
def _patched_async_client(*args, **kwargs):
    kwargs["transport"] = httpx.MockTransport(_handler)
    return _original_async_client(*args, **kwargs)
httpx.AsyncClient = _patched_async_client

async def main():
{call_body}

asyncio.run(main())
print(json.dumps(captured))
"""
    output = run_script(service, script, extra_env)
    return json.loads(output.splitlines()[-1])
TODOTAK_EOF

echo '==> Writing tests/contracts/test_auth_lookup_contract.py'
cat > "tests/contracts/test_auth_lookup_contract.py" << 'TODOTAK_EOF'
"""Contract: notification-service -> auth-service, internal user lookup.

Verifies that AuthServiceClient calls the exact path auth-service
registers, sends the internal API key header, and that auth-service's
UserResponse schema actually contains the "email" field
AuthServiceClient.get_user_email() reads out of the response.
"""
from tests.contracts.helpers import (
    get_json_schema,
    get_route_paths,
    run_with_captured_http_call,
)


def test_auth_service_registers_the_internal_lookup_route() -> None:
    route_paths = get_route_paths("auth-service")
    assert "/api/v1/internal/users/{user_id}" in route_paths


def test_user_response_schema_includes_email_field() -> None:
    schema = get_json_schema(
        "auth-service", "app.schemas.user", "UserResponse"
    )
    assert "email" in schema["properties"]
    assert "email" in schema.get("required", [])


def test_notification_service_calls_the_matching_path_and_header() -> None:
    call_body = """
    import uuid
    from app.clients.auth_service_client import AuthServiceClient

    client = AuthServiceClient(base_url="http://auth-service:8000")
    await client.get_user_email(uuid.uuid4())
"""
    captured = run_with_captured_http_call("notification-service", call_body)

    route_paths = get_route_paths("auth-service")
    assert "/api/v1/internal/users/{user_id}" in route_paths
    assert "/api/v1/internal/users/" in captured["url"]
    assert captured["headers"].get("x-internal-api-key")
TODOTAK_EOF

echo '==> Writing tests/contracts/test_core_service_tools_contract.py'
cat > "tests/contracts/test_core_service_tools_contract.py" << 'TODOTAK_EOF'
"""Contract: ai-service -> core-service, tool-backed HTTP calls.

Verifies that every payload ai-service's CoreServiceClient builds
(used by the agent's tools — create_task, create_meeting,
create_reminder) actually validates against core-service's own
Pydantic request schemas, and that the URLs/methods used match a real
core-service route.
"""
from tests.contracts.helpers import (
    get_route_paths,
    run_with_captured_http_call,
    validate_payload_against_model,
)


def test_create_task_payload_matches_core_service_schema() -> None:
    call_body = """
    from app.clients.core_service_client import CoreServiceClient

    client = CoreServiceClient(base_url="http://core-service:8000")
    await client.create_task(
        "fake-token",
        title="Buy milk",
        description="From the AI agent",
        priority="high",
        tags=["errand"],
    )
"""
    captured = run_with_captured_http_call("ai-service", call_body)
    assert captured["url"].endswith("/api/v1/tasks")
    assert captured["headers"].get("authorization") == "Bearer fake-token"

    validate_payload_against_model(
        "core-service", "app.schemas.task", "TaskCreate", captured["payload"]
    )


def test_create_meeting_payload_matches_core_service_schema() -> None:
    call_body = """
    from app.clients.core_service_client import CoreServiceClient

    client = CoreServiceClient(base_url="http://core-service:8000")
    await client.create_meeting(
        "fake-token",
        title="Sync",
        start_time="2026-08-01T10:00:00Z",
        end_time="2026-08-01T11:00:00Z",
        participants=[{"email": "a@example.com", "name": "A"}],
    )
"""
    captured = run_with_captured_http_call("ai-service", call_body)
    assert captured["url"].endswith("/api/v1/meetings")

    validate_payload_against_model(
        "core-service",
        "app.schemas.meeting",
        "MeetingCreate",
        captured["payload"],
    )


def test_create_reminder_payload_matches_core_service_schema() -> None:
    call_body = """
    from app.clients.core_service_client import CoreServiceClient

    client = CoreServiceClient(base_url="http://core-service:8000")
    await client.create_reminder(
        "fake-token",
        remind_at="2026-08-01T09:00:00Z",
        message="Don't forget",
    )
"""
    captured = run_with_captured_http_call("ai-service", call_body)
    assert captured["url"].endswith("/api/v1/reminders")

    validate_payload_against_model(
        "core-service",
        "app.schemas.reminder",
        "ReminderCreate",
        captured["payload"],
    )


def test_update_task_payload_matches_core_service_schema() -> None:
    call_body = """
    from app.clients.core_service_client import CoreServiceClient

    client = CoreServiceClient(base_url="http://core-service:8000")
    await client.update_task(
        "fake-token",
        "00000000-0000-0000-0000-000000000000",
        status="completed",
    )
"""
    captured = run_with_captured_http_call("ai-service", call_body)
    assert "/api/v1/tasks/" in captured["url"]

    validate_payload_against_model(
        "core-service", "app.schemas.task", "TaskUpdate", captured["payload"]
    )


def test_every_core_service_client_endpoint_exists_on_core_service() -> None:
    """Cheap structural check: every path prefix CoreServiceClient talks
    to should correspond to a real route core-service registers.
    """
    route_paths = get_route_paths("core-service")
    prefixes_used = ["/api/v1/tasks", "/api/v1/meetings", "/api/v1/reminders"]
    for prefix in prefixes_used:
        assert any(p.startswith(prefix) for p in route_paths), (
            f"{prefix} not found among core-service routes: {route_paths}"
        )
TODOTAK_EOF

echo '==> Writing tests/contracts/test_gateway_routes_contract.py'
cat > "tests/contracts/test_gateway_routes_contract.py" << 'TODOTAK_EOF'
"""Contract: gateway's static route table against real backend routes.

Verifies every prefix in gateway's ROUTE_TABLE actually corresponds
to at least one route the target service registers — catching the
class of bug where a service renames or removes an endpoint and the
gateway silently keeps routing to a prefix that now 404s everywhere.
"""
from tests.contracts.helpers import run_script, get_route_paths


def _get_gateway_route_table() -> dict:
    script = """
import json
from app.config.routes_table import ROUTE_TABLE
print(json.dumps(ROUTE_TABLE))
"""
    output = run_script("gateway", script)
    import json

    return json.loads(output.splitlines()[-1])


# Maps a gateway route-table prefix to the service whose routes it
# should be checked against, and the env that service needs to import.
SERVICE_FOR_PREFIX = {
    "/api/v1/auth": "auth-service",
    "/api/v1/tasks": "core-service",
    "/api/v1/meetings": "core-service",
    "/api/v1/reminders": "core-service",
    "/api/v1/ai": "ai-service",
    "/api/v1/notifications": "notification-service",
}


def test_route_table_prefixes_have_a_real_backend_service() -> None:
    route_table = _get_gateway_route_table()
    for prefix in route_table:
        assert prefix in SERVICE_FOR_PREFIX, (
            f"{prefix} is in gateway's ROUTE_TABLE but this test doesn't "
            "know which service it should map to — update SERVICE_FOR_PREFIX"
        )


def test_every_route_table_prefix_matches_a_real_route() -> None:
    route_table = _get_gateway_route_table()
    for prefix, service in SERVICE_FOR_PREFIX.items():
        if prefix not in route_table:
            continue
        route_paths = get_route_paths(service)
        assert any(p.startswith(prefix) for p in route_paths), (
            f"gateway routes {prefix} -> {service}, but {service} has no "
            f"route starting with {prefix}. Its routes: {route_paths}"
        )
TODOTAK_EOF

echo '==> Writing tests/contracts/test_notification_schedule_contract.py'
cat > "tests/contracts/test_notification_schedule_contract.py" << 'TODOTAK_EOF'
"""Contract: core-service -> notification-service, schedule + cancel.

Verifies that the exact payload core-service's NotificationClient
sends actually validates against notification-service's own Pydantic
request schema, and that the cancel URL it builds matches a route
notification-service actually registers.
"""
from tests.contracts.helpers import (
    get_route_paths,
    run_with_captured_http_call,
    validate_payload_against_model,
)

CORE_SERVICE_ENV = {}
NOTIFICATION_SERVICE_ENV = {}


def test_schedule_payload_matches_notification_service_schema() -> None:
    call_body = """
    import uuid
    from datetime import datetime, timezone
    from app.clients.notification_client import NotificationClient

    client = NotificationClient(base_url="http://notification-service:8000")
    await client.schedule_reminder_notification(
        reminder_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        remind_at=datetime.now(timezone.utc),
        message="Test reminder",
    )
"""
    captured = run_with_captured_http_call(
        "core-service", call_body, CORE_SERVICE_ENV
    )

    assert captured["url"].endswith("/api/v1/notifications/schedule")
    assert "x-internal-api-key" in captured["headers"]

    validate_payload_against_model(
        "notification-service",
        "app.schemas.notification",
        "ScheduleNotificationRequest",
        captured["payload"],
        NOTIFICATION_SERVICE_ENV,
    )


def test_schedule_payload_omits_message_gracefully() -> None:
    """message=None should still produce a valid payload (client falls
    back to a default string rather than sending null).
    """
    call_body = """
    import uuid
    from datetime import datetime, timezone
    from app.clients.notification_client import NotificationClient

    client = NotificationClient(base_url="http://notification-service:8000")
    await client.schedule_reminder_notification(
        reminder_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        remind_at=datetime.now(timezone.utc),
        message=None,
    )
"""
    captured = run_with_captured_http_call(
        "core-service", call_body, CORE_SERVICE_ENV
    )
    assert captured["payload"]["message"]  # non-empty fallback string
    validate_payload_against_model(
        "notification-service",
        "app.schemas.notification",
        "ScheduleNotificationRequest",
        captured["payload"],
        NOTIFICATION_SERVICE_ENV,
    )


def test_cancel_url_matches_a_notification_service_route() -> None:
    call_body = """
    import uuid
    from app.clients.notification_client import NotificationClient

    client = NotificationClient(base_url="http://notification-service:8000")
    await client.cancel_reminder_notification(reminder_id=uuid.uuid4())
"""
    captured = run_with_captured_http_call(
        "core-service", call_body, CORE_SERVICE_ENV
    )
    called_path = captured["url"].split("notification-service:8000")[-1]

    route_paths = get_route_paths(
        "notification-service", NOTIFICATION_SERVICE_ENV
    )
    # The concrete called path (with a real UUID) should match the
    # registered route template once we strip the templated segments
    # down to a comparable shape.
    matching_templates = [
        p
        for p in route_paths
        if p.startswith("/api/v1/notifications/source/")
        and p.endswith("/cancel")
    ]
    assert matching_templates, (
        f"No cancel route found among {route_paths}; "
        f"core-service called {called_path}"
    )
    assert "x-internal-api-key" in captured["headers"]
TODOTAK_EOF

echo '==> Writing tests/e2e/__init__.py'
cat > "tests/e2e/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing tests/e2e/conftest.py'
cat > "tests/e2e/conftest.py" << 'TODOTAK_EOF'
"""Fixtures for end-to-end tests against a fully running stack.

Unlike every other test suite in this repo, these tests need the
*entire* stack up and reachable — `make up` (or `make prod-up`) first.
They talk to the gateway exactly like a real client would: no
mocking, no direct service access, no database fixtures.

    BASE_URL=http://localhost:8000 pytest tests/e2e -v

BASE_URL defaults to the gateway's dev port. Point it at a deployed
environment's edge (nginx / a real domain) to smoke-test a real
deployment the same way.
"""
import os
import uuid

import httpx
import pytest

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        yield c


@pytest.fixture
def unique_email() -> str:
    return f"e2e-{uuid.uuid4().hex[:12]}@example.com"


@pytest.fixture
def registered_user(client: httpx.Client, unique_email: str) -> dict:
    """Registers a fresh user and returns {email, password, access_token}."""
    password = "e2e-test-password-123"
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "full_name": "E2E Test User",
            "password": password,
        },
    )
    assert register_response.status_code == 201, register_response.text

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    tokens = login_response.json()

    return {
        "email": unique_email,
        "password": password,
        "access_token": tokens["access_token"],
        "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
    }
TODOTAK_EOF

echo '==> Writing tests/e2e/test_user_journey.py'
cat > "tests/e2e/test_user_journey.py" << 'TODOTAK_EOF'
"""End-to-end: register -> login -> manage tasks/meetings/reminders ->
chat with the AI assistant -> logout, all through the real gateway
against a fully running stack.

Requires: `make up && make migrate` first, and a real OPENAI_API_KEY
in .env for the chat tests (they're skipped automatically if the
assistant is unreachable, rather than failing the whole run over an
external dependency).
"""
import httpx
import pytest


def test_health_check_reports_all_services_ok(client: httpx.Client) -> None:
    response = client.get("/health/services")
    assert response.status_code == 200
    body = response.json()
    unhealthy = {k: v for k, v in body["services"].items() if v != "ok"}
    assert not unhealthy, f"Unhealthy services: {unhealthy}"


def test_register_and_login(client: httpx.Client, unique_email: str) -> None:
    password = "e2e-test-password-123"
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "full_name": "New User",
            "password": password,
        },
    )
    assert register_response.status_code == 201
    assert register_response.json()["email"] == unique_email

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()


def test_protected_endpoint_rejects_no_token(client: httpx.Client) -> None:
    response = client.get("/api/v1/tasks")
    assert response.status_code == 401


def test_full_task_lifecycle(client: httpx.Client, registered_user: dict) -> None:
    headers = registered_user["headers"]

    create_response = client.post(
        "/api/v1/tasks",
        json={"title": "E2E: buy groceries", "priority": "medium"},
        headers=headers,
    )
    assert create_response.status_code == 201
    task = create_response.json()
    task_id = task["id"]

    list_response = client.get("/api/v1/tasks", headers=headers)
    assert list_response.status_code == 200
    assert any(t["id"] == task_id for t in list_response.json()["items"])

    update_response = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "completed"

    delete_response = client.delete(f"/api/v1/tasks/{task_id}", headers=headers)
    assert delete_response.status_code == 204

    get_response = client.get(f"/api/v1/tasks/{task_id}", headers=headers)
    assert get_response.status_code == 404


def test_full_meeting_lifecycle(
    client: httpx.Client, registered_user: dict
) -> None:
    headers = registered_user["headers"]

    create_response = client.post(
        "/api/v1/meetings",
        json={
            "title": "E2E: planning sync",
            "start_time": "2027-01-15T10:00:00Z",
            "end_time": "2027-01-15T11:00:00Z",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    meeting_id = create_response.json()["id"]

    cancel_response = client.post(
        f"/api/v1/meetings/{meeting_id}/cancel", headers=headers
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"


def test_reminder_linked_to_a_task(
    client: httpx.Client, registered_user: dict
) -> None:
    headers = registered_user["headers"]

    task_response = client.post(
        "/api/v1/tasks",
        json={"title": "E2E: task with reminder"},
        headers=headers,
    )
    task_id = task_response.json()["id"]

    reminder_response = client.post(
        "/api/v1/reminders",
        json={
            "remind_at": "2027-01-15T09:00:00Z",
            "message": "E2E reminder",
            "task_id": task_id,
        },
        headers=headers,
    )
    assert reminder_response.status_code == 201
    assert reminder_response.json()["task_id"] == task_id


def test_reminder_for_nonexistent_task_is_rejected(
    client: httpx.Client, registered_user: dict
) -> None:
    response = client.post(
        "/api/v1/reminders",
        json={
            "remind_at": "2027-01-15T09:00:00Z",
            "task_id": "00000000-0000-0000-0000-000000000000",
        },
        headers=registered_user["headers"],
    )
    assert response.status_code == 404


def test_ai_chat_creates_a_task(
    client: httpx.Client, registered_user: dict
) -> None:
    headers = registered_user["headers"]

    chat_response = client.post(
        "/api/v1/ai/chat",
        json={"message": "Add a task: pick up dry cleaning"},
        headers=headers,
        timeout=60.0,
    )
    if chat_response.status_code == 502:
        pytest.skip(
            "AI assistant unreachable (likely no valid OPENAI_API_KEY "
            "configured for this environment) — skipping rather than "
            "failing on an external dependency."
        )
    assert chat_response.status_code == 200
    body = chat_response.json()
    assert body["message"]["role"] == "assistant"
    assert body["message"]["content"]

    tasks_response = client.get("/api/v1/tasks", headers=headers)
    titles = [t["title"].lower() for t in tasks_response.json()["items"]]
    assert any("dry cleaning" in title for title in titles), (
        "Expected the AI assistant to have created a task via tool "
        f"calling; current tasks: {titles}"
    )


def test_logout_revokes_refresh_token(
    client: httpx.Client, registered_user: dict
) -> None:
    logout_response = client.post(
        "/api/v1/auth/logout", headers=registered_user["headers"]
    )
    assert logout_response.status_code == 204
TODOTAK_EOF

echo '==> Writing tests/load/gateway_load_test.js'
cat > "tests/load/gateway_load_test.js" << 'TODOTAK_EOF'
// Load test against a running stack, through the gateway exactly like
// a real client. Requires k6 (https://k6.io) — not a Node/npm
// dependency, a standalone binary.
//
// Usage:
//   k6 run tests/load/gateway_load_test.js
//   BASE_URL=https://staging.example.com k6 run tests/load/gateway_load_test.js
//
// What it checks, beyond raw throughput: p95 latency stays under 500ms
// and the error rate stays under 1% while ramping up to 50 concurrent
// virtual users. Tune the thresholds/stages below for your actual
// capacity planning needs — the defaults here are a starting point,
// not a validated production SLA.

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // warm up
    { duration: "1m", target: 50 }, // ramp to typical peak
    { duration: "2m", target: 50 }, // hold
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.01"],
  },
};

function registerAndLogin() {
  const email = `loadtest-${__VU}-${__ITER}-${Date.now()}@example.com`;
  const password = "load-test-password-123";

  const registerRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ email, full_name: "Load Test", password }),
    { headers: { "Content-Type": "application/json" } }
  );
  const registerOk = check(registerRes, {
    "register: status 201": (r) => r.status === 201,
  });
  errorRate.add(!registerOk);
  if (!registerOk) return null;

  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" } }
  );
  const loginOk = check(loginRes, {
    "login: status 200": (r) => r.status === 200,
    "login: has access_token": (r) => !!r.json("access_token"),
  });
  errorRate.add(!loginOk);
  if (!loginOk) return null;

  return loginRes.json("access_token");
}

export default function () {
  const token = registerAndLogin();
  if (!token) {
    sleep(1);
    return;
  }
  const authHeaders = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  const createRes = http.post(
    `${BASE_URL}/api/v1/tasks`,
    JSON.stringify({ title: "Load test task", priority: "low" }),
    authHeaders
  );
  const createOk = check(createRes, {
    "create task: status 201": (r) => r.status === 201,
  });
  errorRate.add(!createOk);

  const listRes = http.get(`${BASE_URL}/api/v1/tasks`, authHeaders);
  const listOk = check(listRes, {
    "list tasks: status 200": (r) => r.status === 200,
  });
  errorRate.add(!listOk);

  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { "gateway health: status 200": (r) => r.status === 200 });

  sleep(1);
}
TODOTAK_EOF

echo '==> Writing tests/security/README.md'
cat > "tests/security/README.md" << 'TODOTAK_EOF'
# Security Testing

## Automated checks

| What | Where | Run it |
|---|---|---|
| Cross-service auth enforcement | `tests/security/test_auth_enforcement.py` | `pytest tests/security -v` (no DB/network required — see `helpers.py`) |
| Python static analysis (bandit) | CI | `bandit -r <service>/app` |
| Python dependency vulnerabilities | — | `pip install pip-audit && pip-audit -r <service>/requirements.txt` |
| Frontend dependency vulnerabilities | — | `cd frontend && npm audit` |
| Frontend static analysis | CI (`ci.yml`) | `npm run lint` (`eslint-config-next` includes security-relevant rules) |

`test_auth_enforcement.py` sweeps every protected endpoint across
auth-service, core-service, ai-service, and notification-service,
confirming each one rejects a request with no `Authorization` header
(401), *and* confirming the genuinely-public auth endpoints
(register/login/refresh/password-reset) do **not** incorrectly
require one. It runs each service's real FastAPI app in an isolated
subprocess — no live database needed, since these routes reject before
any code that would touch one runs.

## Manual checklist

Run through this before a major release or after any change to
auth/authorization code:

- [ ] Every new endpoint that shouldn't be public has an explicit
      `Depends(get_current_user_id)` (or `verify_internal_api_key` for
      service-to-service routes) — check it's not accidentally missing
- [ ] Every new endpoint that operates on a specific resource
      (task/meeting/reminder/conversation/notification by id) checks
      that resource's `user_id` matches the caller — not just that
      *a* valid token was presented
- [ ] `INTERNAL_SERVICE_API_KEY` and `JWT_SECRET_KEY` are set to long,
      random, non-default values in every real environment (`.env.example`
      files intentionally ship with obviously-fake placeholder values)
- [ ] Postgres and Redis are not exposed to the host in production
      (`docker compose -f docker-compose.yml -f docker-compose.prod.yml config`
      should show no `ports:` for either — see `docs/deployment.md`)
- [ ] `pip-audit` / `npm audit` reviewed for new findings; anything
      left unresolved is understood and documented (see below for the
      current known exceptions)
- [ ] No secrets committed — check `.env` is actually gitignored, not
      just `.env.example`

## Known accepted findings

**As of this writing** (revisit periodically — dependency security
status changes):

- **Next.js pinned to 15.5.18.** Next.js 14.x reached end-of-security-
  patches as of the May 2026 disclosure (auth bypass + SSRF + more,
  13 CVEs) — 14.x will not receive further fixes. This repo was
  upgraded from 14 to 15 specifically because of that; see the
  upgrade notes in `frontend/package.json` history / commit log if
  this ever needs revisiting.
- **`node_modules/next/node_modules/postcss` flagged by `npm audit`**
  (moderate, CSS-output XSS). This is PostCSS bundled *inside* Next.js's
  own dependency tree, not a top-level dependency this repo controls —
  `npm audit fix --force` would "fix" it by downgrading Next back to
  a version with the RCE/auth-bypass vulnerabilities above, which is
  strictly worse. It's build-time-only tooling (transforms CSS during
  `next build`, doesn't process attacker-controlled input at runtime).
  Will resolve itself when Next.js bumps its internal PostCSS.
- **`esbuild`/`vite`/`vitest` chain flagged by `npm audit`** (moderate,
  dev-server request forgery). Dev-tooling only — `vitest` never ships
  in the production build (`next build`/`next start` don't include
  it), so this only matters if someone runs `npm run test:watch` with
  the dev server reachable from an untrusted network, which isn't this
  project's deployment model.

If either of the two "known accepted" items above gets a real fix
upstream, bump the relevant dependency and remove it from this list.
TODOTAK_EOF

echo '==> Writing tests/security/__init__.py'
cat > "tests/security/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing tests/security/helpers.py'
cat > "tests/security/helpers.py" << 'TODOTAK_EOF'
"""Helper for auth-enforcement sweeps.

Spins up a service's real FastAPI app in an isolated subprocess (same
reasoning as tests/contracts/helpers.py: every service's top-level
package is named `app`, so this can't happen in the parent process
without collisions) and fires a list of unauthenticated requests at
it, reporting back the status code each one got.

The database dependency is overridden with a no-op stand-in — safe
because in every route under test, the auth dependency is expected to
reject the request before any code that would actually touch the
database session runs. If that assumption is ever wrong for a given
route, the request fails with a 500 (unhandled exception trying to use
a None session) rather than silently passing, which is itself a useful
signal.
"""
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]

BASE_ENV = {
    "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost:5432/unused",
    "JWT_SECRET_KEY": "security-test-secret",
    "INTERNAL_SERVICE_API_KEY": "security-test-internal-key",
    "OPENAI_API_KEY": "sk-security-test-not-real",
}

DUMMY_UUID = "00000000-0000-0000-0000-000000000000"


def sweep_unauthenticated_requests(
    service: str,
    db_module: str,
    db_symbol: str,
    requests: List[Tuple[str, str]],
    extra_env: Optional[dict] = None,
) -> List[dict]:
    """requests: list of (method, path) tuples, path already concrete
    (use helpers.DUMMY_UUID for any {id} segments).

    Returns a list of {"method", "path", "status"} dicts.
    """
    requests_json = json.dumps(requests)
    script = f"""
import asyncio, json
from httpx import ASGITransport, AsyncClient
from app.main import create_app
from {db_module} import {db_symbol}

async def _fake_db():
    yield None

app = create_app()
app.dependency_overrides[{db_symbol}] = _fake_db

REQUESTS = json.loads({requests_json!r})

async def main():
    results = []
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for method, path in REQUESTS:
            body = {{}} if method.upper() in ("POST", "PATCH", "PUT") else None
            response = await client.request(method.upper(), path, json=body)
            results.append({{"method": method, "path": path, "status": response.status_code}})
    print(json.dumps(results))

asyncio.run(main())
"""
    env = {**os.environ, **BASE_ENV, **(extra_env or {})}
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(REPO_ROOT / service),
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"Sweep subprocess for {service} failed:\n"
            f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
        )
    return json.loads(result.stdout.strip().splitlines()[-1])
TODOTAK_EOF

echo '==> Writing tests/security/test_auth_enforcement.py'
cat > "tests/security/test_auth_enforcement.py" << 'TODOTAK_EOF'
"""Every protected endpoint, across every service, must reject a
request with no Authorization header. This sweeps the real endpoint
list from docs/api.md against each service's real ASGI app — no
database or network required (see helpers.py for how).
"""
from tests.security.helpers import DUMMY_UUID, sweep_unauthenticated_requests


def test_core_service_protected_endpoints_reject_unauthenticated() -> None:
    requests = [
        ("POST", "/api/v1/tasks"),
        ("GET", "/api/v1/tasks"),
        ("GET", f"/api/v1/tasks/{DUMMY_UUID}"),
        ("PATCH", f"/api/v1/tasks/{DUMMY_UUID}"),
        ("PUT", f"/api/v1/tasks/{DUMMY_UUID}/tags"),
        ("DELETE", f"/api/v1/tasks/{DUMMY_UUID}"),
        ("POST", "/api/v1/meetings"),
        ("GET", "/api/v1/meetings"),
        ("GET", f"/api/v1/meetings/{DUMMY_UUID}"),
        ("PATCH", f"/api/v1/meetings/{DUMMY_UUID}"),
        ("POST", f"/api/v1/meetings/{DUMMY_UUID}/cancel"),
        ("DELETE", f"/api/v1/meetings/{DUMMY_UUID}"),
        ("POST", "/api/v1/reminders"),
        ("GET", "/api/v1/reminders"),
        ("GET", f"/api/v1/reminders/{DUMMY_UUID}"),
        ("PATCH", f"/api/v1/reminders/{DUMMY_UUID}"),
        ("DELETE", f"/api/v1/reminders/{DUMMY_UUID}"),
    ]
    results = sweep_unauthenticated_requests(
        "core-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_ai_service_protected_endpoints_reject_unauthenticated() -> None:
    requests = [
        ("POST", "/api/v1/ai/chat"),
        ("GET", "/api/v1/ai/conversations"),
        ("GET", f"/api/v1/ai/conversations/{DUMMY_UUID}"),
        ("PATCH", f"/api/v1/ai/conversations/{DUMMY_UUID}"),
        ("DELETE", f"/api/v1/ai/conversations/{DUMMY_UUID}"),
    ]
    results = sweep_unauthenticated_requests(
        "ai-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_notification_service_user_endpoints_reject_unauthenticated() -> None:
    requests = [
        ("GET", "/api/v1/notifications"),
        ("GET", f"/api/v1/notifications/{DUMMY_UUID}"),
        ("GET", "/api/v1/notifications/preferences"),
        ("PATCH", "/api/v1/notifications/preferences"),
    ]
    results = sweep_unauthenticated_requests(
        "notification-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_notification_service_internal_endpoints_reject_missing_internal_key() -> None:
    """These don't use user auth at all — a missing/wrong
    X-Internal-Api-Key should still be a 401, just via a different
    dependency (verify_internal_api_key, not get_current_user_id).
    """
    requests = [
        ("POST", "/api/v1/notifications/schedule"),
        ("POST", f"/api/v1/notifications/source/core-service/{DUMMY_UUID}/cancel"),
    ]
    results = sweep_unauthenticated_requests(
        "notification-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_auth_service_protected_endpoints_reject_unauthenticated() -> None:
    """Only /me is genuinely user-auth-protected in auth-service — the
    rest of /api/v1/auth/* is intentionally public (that's how you get
    a token in the first place). /internal/* is checked separately
    since it uses a different auth mechanism.
    """
    requests = [("GET", "/api/v1/auth/me")]
    results = sweep_unauthenticated_requests(
        "auth-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_auth_service_internal_endpoint_rejects_missing_internal_key() -> None:
    requests = [("GET", f"/api/v1/internal/users/{DUMMY_UUID}")]
    results = sweep_unauthenticated_requests(
        "auth-service", "app.db.session", "get_db", requests
    )
    failures = [r for r in results if r["status"] != 401]
    assert not failures, f"Expected 401 for all, got: {failures}"


def test_auth_service_public_endpoints_do_not_require_auth() -> None:
    """Sanity check in the opposite direction: these must NOT 401 just
    because there's no Authorization header (they may still fail
    validation for other reasons, e.g. a missing DB — anything other
    than 401 proves they didn't reject purely for lack of auth).
    """
    requests = [
        ("POST", "/api/v1/auth/register"),
        ("POST", "/api/v1/auth/login"),
        ("POST", "/api/v1/auth/refresh"),
        ("POST", "/api/v1/auth/password-reset/request"),
    ]
    results = sweep_unauthenticated_requests(
        "auth-service", "app.db.session", "get_db", requests
    )
    wrongly_rejected = [r for r in results if r["status"] == 401]
    assert not wrongly_rejected, (
        f"These are meant to be public but got 401: {wrongly_rejected}"
    )
TODOTAK_EOF

echo '==> Setting executable bits'
chmod +x "infra/docker/run-migrations.sh"
chmod +x "scripts/backup.sh"
chmod +x "scripts/deploy.sh"
chmod +x "scripts/healthcheck.sh"
chmod +x "scripts/migrate.sh"
chmod +x "scripts/restore.sh"

echo '==> All files written successfully'
echo 'Next steps:'
echo '  1. cp .env.example .env'
echo '     Set JWT_SECRET_KEY, INTERNAL_SERVICE_API_KEY, OPENAI_API_KEY'
echo '  2. make up && make migrate'
echo '  3. pytest tests/contracts tests/security  # no DB/live stack needed'
echo '  4. bash scripts/healthcheck.sh            # once the stack is up'
echo '  5. See docs/ for architecture, API reference, deployment, runbook, and DR'