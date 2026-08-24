# Auth bootstrap hardening plan

Status: deferred / non-blocking for the current auth merge

Last updated: 2026-08-24

## Current decision

The current authentication work is considered merge-ready based on the evidence already collected. We are intentionally deferring a destructive or disposable-environment integration test of the remaining first-admin bootstrap edge cases.

This document records the deferred work so it can be resumed without reconstructing the reasoning later.

## Evidence already collected

The current branch has already been validated with:

- production build: PASS
- existing + new unit/regression suite: 200/200 tests PASS
- auth regression tests: 12/12 PASS
- ESLint: 0 errors; remaining warnings are unrelated to auth/admin changes
- real local Supabase/GoTrue first-account bootstrap: PASS
- first account becomes active administrator: PASS
- later registration with approval enabled becomes pending: PASS
- registration CTA respects enabled/disabled registration policy: PASS
- service-role access to registration/account policy tables: PASS
- deferred bootstrap trigger sees the final GoTrue `app_metadata`: PASS
- last-active-admin protection for demote/disable/delete: PASS
- the same admin operations are allowed when another active administrator remains: PASS

The current implementation therefore has strong functional evidence, but the cases below are not yet independently proven in a disposable integration environment.

## Deferred work: isolated Supabase bootstrap security tests

### Goal

Create a disposable Supabase environment that can be emptied and recreated freely. Do not use the normal developer database for these tests.

Use the repository's real declarative schema and generated migrations. The test environment must exercise real PostgreSQL triggers and real GoTrue behavior rather than replacing them with mocks.

### Why this is deferred

The remaining scenarios require a database with zero auth users and, for concurrency testing, simultaneous account-creation attempts. Repeatedly resetting the current working Supabase installation is unnecessary risk because that installation is now functioning and contains the administrator setup used for manual validation.

### Required scenarios

#### H1. Concurrent trusted bootstrap attempts

Start with exactly zero rows in `auth.users`.

Issue two first-admin bootstrap requests concurrently using different credentials. Both requests must use the normal pCAD bootstrap API path and therefore the server-side Supabase Admin API with:

```text
app_metadata.pcad_bootstrap = true
```

Expected result:

- exactly one request succeeds;
- the successful account is `admin + active`;
- the losing request fails cleanly, normally as `bootstrap_unavailable` / `pcad_bootstrap_unavailable` depending on the layer observed;
- the losing transaction leaves no orphan auth user, profile, or `user_accounts` row;
- after both requests settle there is exactly one auth user and exactly one active administrator;
- `bootstrapAvailable` is false.

This is the primary concurrency proof for the transaction advisory lock in `enforce_first_admin_bootstrap()`.

#### H2. Ordinary email signup cannot claim first administrator

Start with zero auth users and normal registration state as required by the test.

Create an account through the ordinary anonymous Supabase email signup path, without trusted `pcad_bootstrap` app metadata.

Expected result:

- the first-account transaction is rejected by the database bootstrap guard;
- expected database-side reason is `pcad_first_account_requires_bootstrap` or its API-mapped equivalent;
- no auth user remains after rollback;
- no profile or `user_accounts` row remains;
- `bootstrapAvailable` remains true.

This proves that possession of the public anon key or direct access to the normal client signup API cannot capture the first-admin position.

#### H3. Social identity cannot become the first administrator

Start with zero auth users.

Attempt first-account creation through a real configured social provider flow if a disposable provider configuration is available.

Expected result:

- social-first account creation is rejected;
- no auth/profile/account residue remains;
- bootstrap remains available for the trusted username/email + password bootstrap path.

If a real OAuth provider cannot reasonably be configured in the disposable environment, a database/GoTrue integration test using provider metadata may be used as partial evidence, but it must be documented as partial. A simulated unit test alone is not sufficient to mark the real social-provider case complete.

### Additional useful scenarios

These are recommended while the disposable environment exists but are secondary to H1-H3:

- bootstrap with username creates the internal `<username>@pcad.invalid` auth identity and returns the expected public account fields;
- bootstrap with a real email preserves that email as the contact/auth identity;
- a second sequential trusted bootstrap attempt fails after the first succeeds;
- first bootstrap still works when normal registration is disabled;
- later ordinary registration follows `require_admin_approval=true` -> `pending`;
- later ordinary registration follows `require_admin_approval=false` -> `active`;
- bootstrap marker on a non-first account is rejected with `pcad_bootstrap_unavailable`;
- a failed bootstrap attempt does not leave partial state;
- declarative schema replay from scratch produces the deferred constraint trigger correctly.

## Suggested implementation approach

Prefer a dedicated integration test target rather than adding destructive behavior to the normal `npm test` suite.

A suitable structure would be conceptually similar to:

```text
tests/integration/authBootstrap.supabase.test.ts
```

The test harness should:

1. create or target a disposable local Supabase stack/database;
2. apply the repository schema/migrations from scratch;
3. assert zero auth users before each bootstrap-security scenario;
4. invoke real HTTP/Admin/Auth endpoints where the behavior under test belongs to GoTrue;
5. query the database afterward to verify both success state and absence of partial rows;
6. tear down or reset only the disposable environment.

Do not weaken production triggers or add test-only bypasses to make these tests easier.

## Concurrency test notes

The current database design uses a transaction advisory lock keyed by:

```sql
pg_catalog.hashtext('pcad:first-admin')
```

inside the deferred first-admin constraint-trigger function.

The intended concurrent behavior is:

1. transaction A obtains the advisory lock;
2. transaction B waits;
3. A observes itself as the only auth user and completes as the first active admin;
4. A commits;
5. B obtains the lock and observes that the installation is no longer a first-user state;
6. B raises `pcad_bootstrap_unavailable` and rolls back.

The implementation is deliberately designed this way, but this sequence is not considered proven until H1 passes against a real disposable PostgreSQL/GoTrue environment.

## Completion criteria

This deferred hardening item may be marked complete when:

- H1 passes repeatedly, not only once;
- H2 passes against the real anonymous signup path;
- H3 passes against a real social provider flow, or is explicitly recorded as partially verified if real OAuth setup remains impractical;
- no scenario leaves orphan `auth.users`, `profiles`, or `user_accounts` rows;
- schema replay/migrations are reproducible from an empty database;
- the normal unit/regression suite still passes afterward.

Recommended repetition for H1: run the concurrent bootstrap race at least 10 times in a freshly reset disposable environment to make timing-dependent failures easier to expose.

## Merge policy for current work

As of 2026-08-24, this hardening plan is not a blocker for the current auth merge. It is a documented residual integration-test risk, not a known functional defect.

When authentication work is resumed, read this file before changing first-admin bootstrap semantics, `handle_new_user()`, `enforce_first_admin_bootstrap()`, registration policy handling, or account-admin invariants.
