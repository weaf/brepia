-- Extensions present in the migrated database and required to keep declarative
-- schema diff from proposing unrelated removals.
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
