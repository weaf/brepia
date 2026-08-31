# Brepia Supabase Settings Skill

## Purpose

Guide safe Brepia database/settings changes using the repository's current declarative Supabase workflow.

## Source of truth

Before changing the database, read:

- `AGENTS.md`;
- `.cursor/rules/database-workflow.mdc`;
- `docs/local_supabase_lifecycle.md`;
- the relevant files in `supabase/schemas/` and the most recent related migrations.

Do not use historical settings plans as schema authority when the live schema differs.

## Required workflow

1. Ensure the local Supabase stack is available through the repository-local CLI/rootless Podman workflow.
2. Edit the declarative source in `supabase/schemas/` first.
3. Generate the migration with:

   ```bash
   npx supabase db diff -f <migration_name>
   ```

4. Review the generated migration carefully. It should reflect the intended schema delta only.
5. Apply pending migrations locally:

   ```bash
   npx supabase migration up
   ```

6. Regenerate database types:

   ```bash
   npx supabase gen types typescript --local > shared/database.ts
   ```

7. Run the relevant tests plus typecheck/lint/build.

Never hand-edit `shared/database.ts`.

## Schema and RLS rules

- Inspect existing table/schema conventions instead of assuming every table has the same columns, key type, grants or policy structure.
- User-owned data must preserve appropriate ownership/RLS semantics.
- Use `auth.uid()`-based policies where that matches the current user-owned-table pattern.
- Add indexes/constraints only when required by the data model or access pattern.
- Destructive schema changes require explicit scope and migration planning; do not treat "additive only" as a substitute for understanding the requested change.
- Generated migrations are reviewable output. Do not manually invent a migration as the normal first step.

## Credential-bearing provider data

For AI-provider settings:

- credentials are server-only and encrypted at rest using the existing provider credential implementation;
- never log plaintext credentials or authorization headers;
- never return encrypted credential columns or plaintext secrets to the client;
- preserve the existing API contract that exposes credential presence/status rather than secret values;
- reuse current provider DTO/validation/server modules instead of creating a second credential format.

## Remote database restrictions

The normal workflow is local. Do not use database push/pull commands or otherwise mutate a remote Supabase project as routine development work. Remote mutation requires an explicit task with a clear target; follow `.cursor/rules/deployment-restrictions.mdc`.

## Completion check

Confirm all of the following before declaring a database task complete:

- declarative schema and generated migration agree;
- the migration applies successfully to local Supabase;
- `shared/database.ts` was regenerated if schema types changed;
- RLS/authorization behavior remains correct;
- secrets are not exposed;
- tests/typecheck/lint/build relevant to the change pass;
- `git diff --check` is clean.
