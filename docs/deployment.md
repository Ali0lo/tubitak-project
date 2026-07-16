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
