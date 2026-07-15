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
