# pCAD Supabase Settings Migration Skill

## Purpose

Guide safe database migrations for pCAD local customization settings, following the project's established patterns.

## Project Conventions (from migration audit)

### UUID Generation

- Use `gen_random_uuid()` as default for primary keys.
- All tables use UUID primary keys.

### Timestamps

- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- Updates set `updated_at = now()` explicitly in SQL statements.

### RLS Pattern

- Every user-owned table: `ENABLE ROW LEVEL SECURITY`
- Policies use `auth.uid()` for user identity.
- Policies follow the pattern:
  ```sql
  CREATE POLICY "<name>"
    ON <table>
    FOR <operation>
    TO authenticated
    USING (auth.uid() = user_id);
  ```
- Grants for `anon`, `authenticated`, `service_role`, `postgres`.

### Migration Style

- Files named: `<timestamp>_<description>.sql`
- Additive only — never modify or drop existing tables/columns unless a fix requires it.
- One logical change per migration file.
- RLS policies and grants included in the same migration.

### Generated Types

- Check if `@supabase/ssr` or similar generates types from schema.
- Run `supabase gen types` if available, otherwise inspect generated types directory.

## Must Do (for every migration task)

1. **Inspect latest migrations** — Read the most recent migration(s) to understand current schema state and conventions.
2. **Additive only** — Create new tables or columns; do not alter existing tables unless the plan explicitly requires a fix.
3. **User scoping** — Every user-owned row must contain `user_id uuid` referencing `auth.users(id)`.
4. **RLS enabled** — Every new user-owned table must have RLS enabled with policies for:
   - `SELECT` — user's own rows: `USING (auth.uid() = user_id)`
   - `INSERT` — user can insert their own row: `CHECKING (auth.uid() = user_id)`
   - `UPDATE` — user can update their own rows: `USING (auth.uid() = user_id)`
   - `DELETE` — user can delete their own rows (if applicable)
5. **No plaintext secrets** — Provider credentials must be stored encrypted; never select credential columns in API responses.
6. **Regenerate types** — Run the repo's type-generation command after schema changes.
7. **Validate locally** — Apply migration to local Supabase before marking task done.

## Must NOT Do

- Hand-edit generated DB types unless the repository already treats them as hand-maintained.
- Store provider API keys in plaintext.
- Return credential columns (`credential_ciphertext`, `credential_iv`, `credential_tag`) in API responses.
- Create migrations that drop or rename existing tables.
- Skip RLS on user-owned tables.
- Use `postgres` role policies — use `authenticated` role with `auth.uid()` checks.

## Credential Handling

- Encrypt with server-side encryption (e.g., `pgp_sym_encrypt` or application-level encryption).
- Store `credential_ciphertext`, `credential_iv`, `credential_tag` as separate columns.
- `has_credential` is derived server-side (check if ciphertext column is non-null), NOT stored.
- Never log credential values or include them in error messages.

## Migration Template

```sql
-- PxxX: <description>
-- Purpose: <why this migration exists>

BEGIN;

-- 1. Create table
CREATE TABLE public.<table_name> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ...
);

-- 2. RLS
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "<table>_select"
  ON public.<table_name>
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "<table>_insert"
  ON public.<table_name>
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "<table>_update"
  ON public.<table_name>
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Grants
GRANT ALL ON TABLE public.<table_name> TO anon;
GRANT ALL ON TABLE public.<table_name> TO authenticated;
GRANT ALL ON TABLE public.<table_name> TO service_role;
GRANT ALL ON TABLE public.<table_name> TO postgres;

-- 5. Indexes (if needed)
CREATE INDEX <table>_user_id_idx ON public.<table_name> USING btree (user_id);

COMMIT;
```
