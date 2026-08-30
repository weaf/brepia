# Local Supabase lifecycle / NOx review

Status: **WORKSTATION EVIDENCE COLLECTED — FINAL OWNER IDENTIFICATION PENDING**

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

## Workstation evidence — 2026-08-30

The first read-only workstation inspection was run from `/home/thn/ai/pCAD` on `feature/post-merge-functionality` at head `a0aac61`.

Observed command/runtime state:

- no `nox` command found;
- no `NOx` command found;
- no globally installed `supabase` command found;
- `podman` is `/usr/bin/podman`;
- Node/npm/npx are installed under `~/.local/bin`;
- rootless user `podman.socket` is active;
- repository-local Supabase CLI version is `2.114.0`;
- repository-local `supabase status` detects the running local stack.

Observed candidate lifecycle artifacts:

- one matching user systemd unit: `postgres.service`;
- that unit is currently `failed` and its description is `Supabase PostgREST`;
- one matching per-user file: `~/.config/supabase.env`;
- no NOx-named binary or NOx-named user file was found in the initial inspected locations.

Observed running Supabase stack:

- the full local Supabase container set is running and healthy enough for the CLI to detect it;
- container names follow the standard `supabase_*_cadam` convention;
- every inspected container carries `com.supabase.cli.project=cadam`;
- every inspected container carries `com.docker.compose.project=cadam`;
- the database, analytics, vector, Kong, auth, mail, realtime, REST, storage, edge runtime, pg-meta and Studio containers were all present;
- most containers reported healthy and the stack had been up for approximately three days at inspection time.

### Current interpretation

The available evidence does **not** support treating an identifiable NOx executable/configuration as the current lifecycle owner.

The running stack is unmistakably the `cadam` Supabase CLI/Compose project that the repository-local CLI detects. This strongly suggests that the earlier statement "NOx owns Supabase" is either:

1. shorthand for an external launcher that ultimately invokes the Supabase CLI/Podman stack, or
2. stale workstation documentation from an earlier setup.

The failed `postgres.service` cannot currently be assumed to own the healthy stack. It may be an old auxiliary PostgREST service or part of an earlier local setup. Its exact unit metadata and the role of `~/.config/supabase.env` must be inspected before finalizing that conclusion.

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
external or manual workstation lifecycle
        |
        | starts/stops the cadam Supabase containers
        v
running Supabase CLI/Compose stack
        |
        | inspected/operated through repository-local CLI
        v
npx supabase status / migration up / gen types
        |
        v
start.sh + Brepia
```

The remaining question is only the first box: whether a real external launcher still exists or the canonical lifecycle should simply become repository-local `npx supabase start/stop` with the existing Podman compatibility environment.

## Canonical repository-side workflow while review is open

Until the final owner check is complete, keep lifecycle ownership outside the normal repository CLI workflow.

### Normal application startup

Ensure the local Supabase stack is already running, then run:

```bash
./start.sh
```

`start.sh` is authoritative for the Brepia preflight. If it reports that Supabase is unavailable, do not yet automatically substitute a different lifecycle command until the remaining workstation artifacts are reconciled.

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
- do not hand-edit `shared/database.ts`.

`.cursor/rules/database-workflow.mdc` and `.cursor/rules/typescript-workflow.mdc` have been reconciled with this workflow. Their former global `supabase start/stop` assumptions were stale and contradicted `AGENTS.md`/`start.sh`.

## Workstation discovery

Run the repository's read-only inspection helper from the pCAD checkout:

```bash
bash scripts/inspect-local-supabase-lifecycle.sh
```

The helper is intentionally conservative. It reports:

- whether likely `nox` / `NOx`, Supabase, Node/npm and Podman commands are present;
- matching user systemd units plus safe unit metadata such as description, state, fragment path, executable path and environment-file paths;
- candidate NOx/Supabase files under normal user and system launcher/service locations;
- variable **names only** from `~/.config/supabase.env`, never values;
- relevant host process names;
- Podman container names/images and selected non-secret Supabase/Compose lifecycle labels;
- whether the repository-local Supabase CLI can see a running local stack.

It does **not** print `supabase status` output or credential values.

## Evidence required to close the review

The follow-up can be marked complete when the remaining workstation evidence establishes all of the following:

1. what `postgres.service` actually executes and whether it is current or obsolete;
2. what role `~/.config/supabase.env` serves, based on its key names and unit references without exposing values;
3. whether any system-wide launcher/service identifies a real NOx component missed by the initial user-only scan;
4. whether the running `cadam` containers expose working-directory/config-file labels that point directly back to the pCAD/Supabase CLI workflow;
5. one canonical start/stop/status procedure for the workstation.

If no real NOx owner is found after that pass, the expected closeout is to retire the NOx wording and make the repository-local Supabase CLI the explicit lifecycle owner, using the existing rootless Podman socket/shim where required.

## Recovery rule while review is open

If `./start.sh` reports:

```text
Supabase: ERROR - local stack is not running
```

then:

1. do not guess from old NOx wording;
2. run `bash scripts/inspect-local-supabase-lifecycle.sh`;
3. use the verified lifecycle mechanism once identified;
4. rerun `./start.sh`;
5. only after the stack is healthy, run repository-local migration/type-generation commands as needed.
