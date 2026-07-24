# Todotak

An AI-powered task, meeting, and scheduling application built on a microservice architecture. Manage tasks, meetings, recurring schedules, overdue items, and reminders through a responsive Next.js frontend or via natural-language chat with an OpenAI tool-calling agent.

---

## Features

- **Intelligent Overdue Task & Meeting Tracking**: Backend-calculated overdue metadata (`is_overdue`, `overdue_since`, `overdue_duration`, `next_reminder_at`, `last_notification_sent`). Overdue items remain active until manually completed or rescheduled.
- **Recurring Task Engine**: Supports Daily, Weekdays only, Weekly, Biweekly, Monthly, Yearly, and Custom intervals. Completing an occurrence automatically generates the next item in the series.
- **In-App & Email Notifications**: Configurable reminder schedules for tasks and meetings with auto-dismissing in-app popup toasts, persistent history, and unread badge counters.
- **Enhanced Calendar View**: Visual color-coding by status:
  - 🔵 **Blue**: Upcoming
  - 🟠 **Orange**: Today
  - 🟢 **Green**: Completed
  - 🔴 **Red**: Overdue
  - ⚪ **Gray**: Cancelled
  - 🔁 **Recurring Icon**: Indicates recurring tasks/meetings
- **Interactive Dashboard**: Dedicated sections for *Overdue Tasks*, *Today's Tasks*, *Upcoming*, *Missed Meetings*, *Completed Today*, and *Recent Activity* with quick action shortcuts.
- **AI Assistant Tool Integration**: Natural language actions to list overdue items, bulk reschedule overdue tasks to tomorrow, bulk complete tasks, and manage recurring events.
- **Auto Database Migrations**: Alembic migrations run automatically on container startup across all services.

---

## Architecture

Six microservices and a Next.js frontend sitting behind an API gateway:

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

Every service owns its database **schema** (`auth`, `core`, `ai`, `notification`) migrated independently via Alembic. Services communicate over HTTP authenticated via forwarded user JWTs or direct `INTERNAL_SERVICE_API_KEY` verification.

---

## Prerequisites

- Docker and Docker Compose v2
- An OpenAI API key (for the AI chat assistant)
- (Optional) SMTP credentials for email reminders

---

## Quick Start (Local Development)

1. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env: set JWT_SECRET_KEY, INTERNAL_SERVICE_API_KEY, OPENAI_API_KEY
   ```

2. **Start Services & Auto-Migrate**:
   ```bash
   make up          # Builds and starts all microservices (auto-runs migrations on startup)
   ```

3. **Access Services**:

   | Service / Interface | URL |
   |---|---|
   | **Web App** | http://localhost:3000 |
   | **auth-service API Docs** | http://localhost:8001/docs |
   | **core-service API Docs** | http://localhost:8002/docs |
   | **ai-service API Docs** | http://localhost:8003/docs |
   | **notification-service API Docs** | http://localhost:8004/docs |
   | **Grafana** | http://localhost:3001 (`admin` / `GRAFANA_ADMIN_PASSWORD`) |
   | **Prometheus** | http://localhost:9090 |

---

## Production Deployment

```bash
make prod-up
```

Applies `docker-compose.prod.yml` without development ports exposed. Only nginx (port 80) is exposed publicly.

---

## Common Management Commands

Run `make help` for the complete list:

```bash
make up             # Build and start all services
make down           # Stop all services
make logs           # Tail container logs
make migrate        # Manually trigger Alembic migrations across all services
make test-unit      # Run unit test suites
make test-frontend  # Run Next.js type checks and frontend Vitest suite
make shell-db       # Open psql shell inside the Postgres container
```

---

## Repository Layout

```
auth-service/          JWT auth, user management, refresh tokens
core-service/          Tasks, meetings, recurring rules, reminders
ai-service/            OpenAI tool-calling assistant
notification-service/  Email dispatch and in-app toast notification queue
gateway/               API reverse proxy, rate limiting, and auth dispatch
frontend/              Next.js 15 App Router frontend (React 19, Tailwind, Query)
infra/                 Nginx edge proxy, Postgres initialization, Redis config
monitoring/            Prometheus exporter configs and Grafana dashboards
docker-compose.yml     Base Compose stack definition
```
