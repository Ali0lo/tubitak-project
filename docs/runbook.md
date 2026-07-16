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
