# Disaster Recovery

What to do when something is actually broken, not just degraded.
Pair this with `runbook.md` for day-to-day troubleshooting — this
doc is for backups, restores, and full-stack rebuilds.

## What's actually stateful

Only two things hold data that isn't reproducible from source:

- **`postgres_data`** volume — all application data (users, tasks,
  meetings, reminders, AI conversation history, notification records)
  across all 4 schemas.
- **`redis_data`** volume — persisted via `appendonly yes` in
  `infra/redis/redis.conf`, holding the gateway's rate-limit counters
  and notification-service's dispatch queue. Losing this is annoying
  (queued notifications in flight are lost, rate limits reset) but
  not catastrophic — nothing here is the source of truth for
  anything; it can be rebuilt from Postgres state plus a cold start.

Everything else (containers, images, configs) is rebuildable from the
git repo in minutes. Treat Postgres backups as the only thing that
actually matters here.

## Backup: Postgres

Manual, on-demand backup:

```bash
docker compose exec -T postgres pg_dump -U todotak -d todotak --format=custom \
  > backups/todotak-$(date +%Y%m%d-%H%M%S).dump
```

Scheduled (add to host crontab, not inside a container — you want
the backup to survive `docker compose down -v`):

```cron
0 3 * * * cd /path/to/todotak && docker compose exec -T postgres pg_dump -U todotak -d todotak --format=custom > /path/to/backups/todotak-$(date +\%Y\%m\%d).dump
```

Copy backups off the host (S3, another server, wherever) — a backup
that lives on the same disk as the database it's backing up doesn't
protect you from disk failure.

**Retention**: keep at minimum the last 7 daily backups and last 4
weekly backups. Adjust to your actual RPO tolerance (see below).

## Restore: Postgres

```bash
# Stop everything that writes to the DB first
docker compose stop auth-service core-service ai-service notification-service notification-worker gateway

docker compose exec -T postgres pg_restore -U todotak -d todotak --clean --if-exists \
  < backups/todotak-YYYYMMDD-HHMMSS.dump

docker compose start auth-service core-service ai-service notification-service notification-worker gateway
```

If restoring into a brand-new environment (not just an existing
container), bring up `postgres` alone first, wait for it healthy,
then restore, then bring up everything else — otherwise the app
services' automatic `alembic upgrade head` on startup may race with
your restore.

## Full stack rebuild from scratch

If the host itself is gone (not just a container):

1. Provision new host, install Docker + Compose plugin.
2. Clone the repo, `cp .env.example .env`, fill in the **same**
   secrets as before if you have them recorded somewhere secure
   (rotating `JWT_SECRET_KEY`/`INTERNAL_SERVICE_API_KEY` here is fine
   if the old ones are actually lost — it just logs out all users and
   nothing else breaks).
3. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
4. Once `postgres` is healthy, stop the app services, restore the
   latest Postgres backup (see above), then start them.
5. Verify: `docker compose ps` all healthy, hit `/health` on each
   service, log in through the frontend, create a test task.
6. Point DNS at the new host if the IP changed.

## Partial failure scenarios

**Postgres container won't start / data corruption suspected.**
Don't `rm -rf` the volume as a first move. First try
`docker compose logs postgres` — most "won't start" issues are
permission or disk-space related, not corruption. If it really is
corrupted, restore from the most recent backup into a fresh volume
rather than attempting in-place repair.

**A bad migration was deployed and needs undoing.**
Alembic downgrades are not automatic and not guaranteed to be
lossless (a migration that drops a column can't un-drop it without
data loss). Preferred order of operations:
1. If caught immediately and no meaningful writes happened since:
   `docker compose exec <service> alembic downgrade -1`, then fix
   forward.
2. If data has already been written under the new schema: restore
   the pre-migration Postgres backup instead of downgrading — it's
   the only way to guarantee consistency. This is exactly why the
   production checklist requires a fresh backup immediately before
   any deploy that includes migrations.

**Redis is lost entirely (volume deleted, corrupted, whatever).**
Just start it fresh — `docker compose up -d redis`. Rate limits
reset (harmless) and any notifications mid-dispatch in the queue are
lost (re-check `notification-service`'s DB records — undelivered
ones can be re-enqueued once you write that reconciliation logic;
not present as of Phase 8, tracked as a known gap).

**One backend service is down but the rest of the stack is fine.**
The gateway does not currently have per-route circuit breaking — a
downstream service being down will make its routes fail, not take
down the gateway itself. Users hitting unrelated features are
unaffected. `docker compose up -d <service>` to bring it back;
`depends_on: condition: service_healthy` on downstream containers
(e.g. ai-service depends on core-service) means anything depending on
the recovered service will reconnect automatically, no cascading
restart needed.

## Recovery objectives (fill in for your actual deployment)

- [ ] **RPO (Recovery Point Objective)** — how much data loss is
      acceptable? Backup frequency above is set for a same-day RPO;
      tighten it (e.g. WAL archiving / continuous backup) if that's
      not good enough for your use case.
- [ ] **RTO (Recovery Time Objective)** — how long can the app be
      down? A full rebuild-from-scratch as documented above takes
      roughly: provisioning (varies) + `docker compose up -d --build`
      (~5-10 min for images to build) + restore (varies with DB size).
      Time an actual drill rather than assuming.
