# Todotak

An AI-powered task, meeting, Pomodoro, and scheduling application built on a modern microservice architecture. Manage tasks, meetings, Join Call links, recurring schedules, overdue items, and focus timers through a responsive Next.js frontend or via natural-language chat with an OpenAI tool-calling agent.

---

## Key Features

- **AI Automation & Smart Productivity**:
  - **Today's AI Daily Briefing**: Morning productivity summary card with automated metrics aggregation, caching (`localStorage`), and manual refresh.
  - **AI Productivity Coach**: Rotating performance and scheduling tips widget based on execution patterns.
  - **AI Weekly Review Report**: 7-day productivity synthesis covering completion count, streak momentum, recurring routines, and top execution days.
  - **Smart AI Scheduling Recommendations**: Non-intrusive timing suggestions for rescheduling overdue tasks and claiming priority slots with explicit user approval.
  - **Smart Reminders**: Adaptive early notification recommendations for meetings and quiet hours.
  - **Natural Language Bulk Actions**: Command input supporting batch execution (e.g. *"Move all overdue tasks to tomorrow"*, *"Complete every recurring task"*).
  - **AI Project Summary**: Grouped task progress %, risk assessment (Low/Medium/High Risk), and remaining work metrics.
  - **AI Natural Language Search**: Extended Global Search (`/`) supporting queries like *"What did I finish last week?"* or *"Show urgent tasks"*.
- **Intelligent Overdue Task & Meeting Tracking**: Backend-calculated overdue metadata (`is_overdue`, `overdue_since`, `overdue_duration`, `next_reminder_at`, `last_notification_sent`). Overdue items remain active until manually completed or rescheduled.
- **Meeting Join Call Links**: Optional **Join Call Link / Meeting URL** field for meeting creation and clickable **Join Call ↗** hyperlinks on meeting cards and timeline views.
- **Pomodoro Focus Timer**: Integrated Pomodoro timer with Focus, Short Break, and Long Break modes, focus streak counters, sound/alarm banners, and a mini header widget.
- **Cozy Pixel Art Micro-Animations**: Animated retro pixel art micro-illustrations (`PixelCatMascot`, `PixelSleepingCat`, `PixelTomato`, `PixelCoffeeCup`, `PixelSparkle`, `PixelHeart`), including an interactive sidebar mascot widget ("Kiki") with petting feedback and rotating quotes.
- **Productivity Workspace Settings (`/settings`)**: Route for default task views (List, Board, Calendar), theme, dashboard layout density (Compact, Comfortable, Expanded), notifications, AI automation toggles, and Demo Mode seeding.
- **Demonstration Mode**: One-click demo seeding in Settings (`lib/demo-data.ts`) to immediately showcase tasks, meetings, notifications, and AI analytics.
- **Recurring Task Engine**: Supports Daily, Weekdays only, Weekly, Biweekly, Monthly, Yearly, and Custom intervals.
- **Secure Email Verification & Notifications**: Account verification tokens delivered securely via SMTP, plus configurable reminder schedules for tasks and meetings with auto-dismissing in-app popup toasts.
- **Auto Database Migrations**: Alembic migrations run automatically on container startup across all microservices.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `/` | Focus AI Natural Language & Global Search Modal |
| `Esc` | Close Task Details Drawer, Modals, or Search |
| `Cmd+,` / `Ctrl+,` | Navigate to Productivity Settings (`/settings`) |
| `Cmd+K` | Open Command Palette / Global Search |

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

Every service owns its database **schema** (`auth`, `core`, `ai`, `notification`) migrated independently via Alembic.

---

## Prerequisites

- Docker and Docker Compose v2
- An OpenAI API key (for the AI chat assistant)
- (Optional) SMTP credentials for email verification and reminders (e.g. Gmail SMTP)

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

## Testing & Quality Verification

Run type checking and Vitest suite across frontend:

```bash
cd frontend && npm run typecheck && npm run test -- --run
```

Run production bundle build:

```bash
cd frontend && npm run build
```

---

## Production Deployment

```bash
make prod-up
```

Applies `docker-compose.prod.yml` without development ports exposed. Only nginx (port 80) is exposed publicly.

---

## Common Management Commands

```bash
make up             # Build and start all services
make down           # Stop all services
make logs           # Tail container logs
make migrate        # Manually trigger Alembic migrations across all services
make test-unit      # Run unit test suites
make test-frontend  # Run Next.js type checks and frontend Vitest suite
make shell-db       # Open psql shell inside the Postgres container
```
