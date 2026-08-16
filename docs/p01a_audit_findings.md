# P01A — Database Conventions Audit Report

**Date**: 2026-08-16
**Scope**: All migrations, schema definitions, and type generation workflow

---

## 1. UUID Generation Convention

**Finding**: All tables use `gen_random_uuid()` as the default for primary key UUIDs.

**Evidence**:

- `20250830041942_initialize.sql.sql`: `id uuid not null default gen_random_uuid()`
- `20260302193359_schema_update.sql`: `id uuid not null default gen_random_uuid()`
- `20260303204633_token_payments.sql`: `id uuid not null default gen_random_uuid()`
- `20260518000000_parametric_ai_sdk_parts.sql`: `ALTER COLUMN id SET DEFAULT gen_random_uuid()`

**No `uuid-ossp` or `pgcrypto` extensions needed** — `gen_random_uuid()` is available from `pgcrypto` extension which is included in Supabase by default.

---

## 2. Timestamp Conventions

### created_at

- Pattern: `created_at timestamptz not null default now()`
- Consistent across all tables.

### updated_at

- Pattern: `updated_at timestamptz not null default now()`
- **NO generic `updated_at` trigger exists** for user-owned tables.
- Updates are explicit in SQL statements: `SET column = value, updated_at = now()`
- Only `previews` table has a `BEFORE UPDATE` trigger that auto-sets `updated_at`.
- This is the pattern to follow for new tables — **explicit updates, not triggers**.

---

## 3. RLS (Row Level Security) Patterns

### Enable RLS

Every user-owned table: `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`

### Policy Pattern

Policies follow this structure:

```sql
CREATE POLICY "<table_name>_<operation>"
  ON public.<table_name>
  FOR <SELECT|INSERT|UPDATE|DELETE>
  TO authenticated
  USING (auth.uid() = user_id)
  [WITH CHECK (auth.uid() = user_id)];
```

For `INSERT`: `WITH CHECK` clause is required to verify the inserted row's user_id.
For `UPDATE`: Both `USING` (read existing rows) and `WITH CHECK` (verify new values) are used.

### Grants Pattern

Every table grants to four roles:

```sql
GRANT ALL ON TABLE public.<table_name> TO anon;
GRANT ALL ON TABLE public.<table_name> TO authenticated;
GRANT ALL ON TABLE public.<table_name> TO service_role;
GRANT ALL ON TABLE public.<table_name> TO postgres;
```

### Special Cases

- `messages` table: Two policies — one for public conversation access, one for user ownership.
- Storage buckets: Policies use `auth.uid()` matched against storage folder names.

---

## 4. Generated Type Workflow

### Command

```bash
supabase gen types typescript --local > shared/database.ts
```

(Referenced from `.cursor/rules/database-workflow.mdc`)

### Config

`supabase/config.toml` specifies schema paths:

```
schema_paths = [
  "./schemas/types.sql",
  "./schemas/conversations.sql",
  "./schemas/prompts.sql",
  "./schemas/*.sql",
]
```

### Schema Files

- `supabase/schemas/types.sql` — enums
- `supabase/schemas/profile.sql` — profiles table
- `supabase/schemas/conversations.sql` — conversations table
- `supabase/schemas/messages.sql` — messages table
- `supabase/schemas/images.sql` — images table
- `supabase/schemas/meshes.sql` — meshes table
- `supabase/schemas/previews.sql` — previews table
- `supabase/schemas/prompts.sql` — prompts table
- `supabase/schemas/storage_policies.sql` — storage RLS policies
- `supabase/schemas/triggers.sql` — triggers

### Generated Types Location

- `shared/database.ts` — TypeScript types exported from `supabase gen types`

### Usage

Other files import from it:

```typescript
import { Database } from './database.ts';
// Database['public']['Tables']['messages']['Row']
```

**IMPORTANT**: After any schema migration, the types must be regenerated and committed.

---

## 5. Foreign Key Constraints

- All user-owned tables reference `auth.users(id)` with `ON DELETE CASCADE`.
- FK validation pattern: `NOT VALID` on creation, `VALIDATE CONSTRAINT` in a separate statement.
- This avoids long locks during migration.

---

## 6. Index Conventions

### Primary Keys

- Unique index on `id` column, then `ALTER TABLE ... ADD CONSTRAINT ... PRIMARY KEY USING INDEX`.

### User Index

- Every user-owned table: `CREATE INDEX <table>_user_id_idx ON public.<table> USING btree (user_id);`

### Timestamp Index

- Tables with `updated_at`: index on `updated_at` column.
- Conversations: `CREATE INDEX conversations_updated_at_idx ON public.conversations USING btree (updated_at);`

---

## 7. Tables Summary

| Table               | PK                | user_id       | RLS             | updated_at trigger              |
| ------------------- | ----------------- | ------------- | --------------- | ------------------------------- |
| profiles            | uuid              | FK auth.users | YES             | NO (explicit)                   |
| conversations       | uuid              | FK auth.users | YES             | NO (trigger on messages insert) |
| messages            | uuid              | no            | YES (via conv.) | NO                              |
| token_balances      | uuid              | FK auth.users | YES             | NO (explicit)                   |
| token_costs         | no (operation PK) | no            | YES             | NO (explicit)                   |
| token_pack_products | uuid              | no            | YES             | NO (explicit)                   |
| token_transactions  | uuid              | FK auth.users | YES             | NO (explicit)                   |
| meshes              | uuid              | FK auth.users | YES             | NO                              |
| previews            | uuid              | FK auth.users | YES             | YES (BEFORE UPDATE trigger)     |
| images              | uuid              | FK auth.users | YES             | NO                              |

---

## 8. Implications for P01B-P01E

### user_ai_preferences (P01B)

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `hidden_model_ids text[] not null default '{}'`
- RLS: SELECT/INSERT/UPDATE on `auth.uid() = user_id`
- No separate trigger needed — explicit `SET updated_at = now()` on updates.
- Unique index NOT needed on `user_id` — it's the PK.

### prompt_profiles (P01C)

- `user_id uuid not null references auth.users(id) on delete cascade`
- `(user_id, lower(name))` unique constraint for non-archived profiles.
- `base_revision` should be a SHA-256 fingerprint of built-in prompt text.
- RLS: SELECT/INSERT/UPDATE/DELETE on `auth.uid() = user_id`.
- Index on `(user_id, archived)` for efficient profile queries.

### ai_providers (P01D)

- `user_id uuid not null references auth.users(id) on delete cascade`
- `(user_id, slug)` unique constraint.
- `credential_ciphertext`, `credential_iv`, `credential_tag` nullable (encrypted).
- RLS: SELECT/INSERT/UPDATE/DELETE on `auth.uid() = user_id`.
- Index on `(user_id, enabled)` for provider listing.

### ai_provider_models (P01D)

- `provider_id uuid FK ai_providers on delete cascade`
- `user_id uuid FK auth.users on delete cascade`
- `(provider_id, model_id)` unique constraint.
- RLS: SELECT/INSERT/UPDATE/DELETE on `auth.uid() = user_id`.
- Index on `(provider_id)` for provider model listing.
