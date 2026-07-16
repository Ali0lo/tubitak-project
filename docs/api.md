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
