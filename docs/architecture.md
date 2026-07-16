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
