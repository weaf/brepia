# Local Customization Settings — Implementation Status

**Branch**: `local-dev-continue`
**HEAD**: `5290e7b` (feat(P01B): create user_ai_preferences table)
**Last Updated**: 2026-08-16

---

## Completed Tasks

### P00A — Create pcad-maintainer development agent

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS
**Implemented**:

- Autonomous repository maintainer agent with read/edit/bash permissions
- Upstream-safety principles (PARAMETRIC_MODELS, PARAMETRIC_AGENT_PROMPT immutable)
- Gate requirements (typecheck, lint, build)
- Commit policy (atomic commits, no auto-merge)
- Status file update format

### P00B — Add skill: upstream-safe customization

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS
**Implemented**:

- Upstream-owned file identification requirement
- Additive module preference
- Built-in definitions preservation
- Sync seam convention for unavoidable upstream edits
- Diff check requirements (`git diff --check`, `git diff --stat`)
- Anti-refactoring rules

### P00C — Add skill: Supabase settings migration

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS
**Implemented**:

- Project conventions documented (UUID, timestamps, RLS)
- Migration template with RLS policies
- Credential handling guidelines
- Additive-only migration policy
- Type regeneration guidance

### P00D — Add skill: AI provider registry

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS
**Implemented**:

- Built-in providers remain source/env managed
- Custom providers additive only
- Secret security (server-only, encrypted, never logged/returned)
- URL validation rules
- Reserved prefix protection
- Provider driver mapping table
- Error handling (no silent fallback)

### P00E — Add skill: settings UI

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS
**Implemented**:

- Visual primitives (shadcn/ui, Tailwind)
- Mobile-safe layout requirements
- Keyboard accessibility
- React Query state management
- Security (never render secrets)
- Save/cancel pattern
- Component structure guidelines

### P00F — Status tracker

**Status**: DONE
**Implementation commit**: `2eab50c`
**Reviewer**: PASS
**Implemented**:

- Branch + HEAD tracking
- Completed tasks with commit SHAs
- Current task, next task, blockers sections
- Reviewer gate results

### P01A — Audit database conventions

**Status**: DONE
**Reviewer**: PASS
**Findings recorded**: `docs/p01a_audit_findings.md`
**Audited**:

- UUID: `gen_random_uuid()` — confirmed across all migrations
- Timestamps: `created_at`/`updated_at` with `default now()` — no generic trigger; explicit updates only (except `previews` table)
- RLS: Every user-owned table has RLS enabled with `auth.uid() = user_id` policies
- Grants: `anon`, `authenticated`, `service_role`, `postgres` on every table
- FK pattern: `ON DELETE CASCADE`, created with `NOT VALID`, validated separately
- Type generation: `supabase gen types typescript --local > shared/database.ts`
- Schema paths: `supabase/schemas/*.sql` — new tables need schema definitions
- No `uuid-ossp` or `pgcrypto` extensions needed (built-in)

### P01B — Create `user_ai_preferences`

**Status**: DONE
**Reviewer**: PASS
**Files Created**:

- `supabase/migrations/20260816135107_user_ai_preferences.sql`
- `supabase/schemas/user_ai_preferences.sql`
  **Implemented**:
- `user_id uuid` primary key → `auth.users(id) ON DELETE CASCADE`
- `hidden_model_ids text[] NOT NULL DEFAULT '{}'`
- `default_prompt_profile_id uuid NULL`
- `created_at`/`updated_at` timestamptz with `default now()`
- RLS: SELECT/INSERT/UPDATE/DELETE on `auth.uid() = user_id`
- Grants: anon, authenticated, service_role, postgres
- No copied model catalog. No provider secrets.

---

## Current Task

P00 + P01A + P01B complete. Ready for P01C.

## Next Task

P01C — Create `prompt_profiles` table with migration, RLS, grants, and uniqueness constraint on `(user_id, lower(name))` for non-archived profiles.

## Validation Evidence

- Typecheck: PASS
- Git diff --check: PASS (no whitespace errors)
- No tracked upstream files modified
- pcad-builder.md: UNMODIFIED ✓

## Blockers

None — ready for P01C.
