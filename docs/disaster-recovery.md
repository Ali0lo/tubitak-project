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
