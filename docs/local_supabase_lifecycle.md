# Local Supabase lifecycle / NOx review

Status: **REPO-SIDE RECONCILED — WORKSTATION IDENTITY PENDING**

Branch: `feature/post-merge-functionality`

Purpose: make the local Supabase workflow explicit and prevent coding agents from silently replacing the workstation lifecycle manager with ad-hoc `supabase start/stop` commands.

## What the repository proves

The repository does **not** contain a NOx implementation, NOx service definition, NOx launcher, or NOx configuration.

The NOx convention was introduced as workstation-specific operating guidance on 2026-08-27. Repository history records the rule that NOx owns the local Supabase service lifecycle, but it does not identify the external program/configuration behind that name.

The repository-local Supabase project itself is conventional:

- `supabase/config.toml` uses project id `cadam`;
- `supabase` is a development dependency and should be invoked through `npx` rather than relying on a global binary;
- schema changes use the declarative files under `supabase/schemas/`;
- generated migrations live under `supabase/migrations/`;
- `shared/database.ts` is generated from the running local database and must not be hand-edited.

## What `start.sh` actually does

`start.sh` deliberately does not start or stop the Supabase stack.

Before checking Supabase it:

1. enables/starts the rootless user `podman.socket`;
2. sets `DOCKER_HOST` to the rootless Podman socket;
3. prepends `scripts/podman/` to `PATH` so the repository Podman compatibility shim is used for Supabase CLI status/label queries;
4. runs `npx supabase status` only as an availability check;
5. exits with an error when the local stack is unavailable;
6. when the stack is available, reads `npx supabase status -o env` internally to populate the local Supabase URL/key environment used by Brepia without printing those credentials.

This means the repository currently has a clean separation:

```text
workstation lifecycle manager
        |
        | starts/stops local Supabase containers
        v
running Supabase stack
        |
        | inspected/operated through repository-local CLI
        v
npx supabase status / migration up / gen types
        |
        v
start.sh + Brepia
```

What remains unproven is the first box: exactly what external workstation component is called NOx and whether it still owns those containers today.

## Canonical repository-side workflow

Until the workstation review establishes otherwise, keep lifecycle ownership outside the repository CLI workflow.

### Normal application startup

Start the local Supabase stack through the workstation lifecycle manager, then run:

```bash
./start.sh
```

`start.sh` is authoritative for the Brepia preflight. If it reports that Supabase is unavailable, do not automatically run `supabase start` or `npx supabase start`.

### Declarative schema change

With the local stack already running:

```bash
# 1. Edit supabase/schemas/*.sql

# 2. Generate and review the migration
npx supabase db diff -f <migration_name>

# 3. Apply pending local migrations
npx supabase migration up

# 4. Regenerate checked-in database types
npx supabase gen types typescript --local > shared/database.ts
```

Project policy remains:

- do not use `db push` in the normal local workflow;
- do not use `db pull` in the normal local workflow;
- do not hand-edit `shared/database.ts`;
- do not introduce a second lifecycle manager merely because the current one is temporarily unavailable.

`.cursor/rules/database-workflow.mdc` has been reconciled with this workflow. Its former global `supabase stop/start` sequence was stale and contradicted both `AGENTS.md` and `start.sh`.

## Workstation discovery

Run the repository's read-only inspection helper from the pCAD checkout:

```bash
bash scripts/inspect-local-supabase-lifecycle.sh
```

The helper is intentionally conservative. It reports:

- whether likely `nox` / `NOx`, Supabase, Node/npm and Podman commands are present;
- user systemd units whose names reference NOx/Supabase/pCAD/Brepia/CADAM;
- candidate NOx/Supabase files under normal per-user config/application locations;
- Podman container names/images related to Supabase/pCAD/Brepia/CADAM;
- whether the repository-local Supabase CLI can see a running local stack.

It does **not** print `supabase status` output or `status -o env`, because modern Supabase status output can contain local API credentials.

## Evidence required to close the review

The NOx follow-up can be marked complete when workstation evidence establishes all of the following:

1. what NOx actually is (binary, desktop launcher, script, systemd unit, container UI, or other tool);
2. where its configuration lives;
3. the real start, stop and status operations for the pCAD/Brepia Supabase stack;
4. whether it currently starts the same `cadam` Supabase containers that `npx supabase status` detects;
5. whether it depends on the rootless Podman socket or another compatibility layer;
6. one canonical recovery procedure when the stack is stopped or missing.

After that evidence is captured, update this document, `AGENTS.md`, `start.sh` comments/error copy if necessary, and `docs/post_merge_functionality_plan.md` together.

## Recovery rule while review is open

If `./start.sh` reports:

```text
Supabase: ERROR - local stack is not running
```

then:

1. do not guess a replacement lifecycle command;
2. run `bash scripts/inspect-local-supabase-lifecycle.sh`;
3. use the discovered workstation manager to restore the stack;
4. rerun `./start.sh`;
5. only after the stack is healthy, run repository-local migration/type-generation commands as needed.
