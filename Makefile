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
