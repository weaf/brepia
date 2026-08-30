# Local Supabase lifecycle review

Status: **COMPLETE**

Branch: `feature/post-merge-functionality`

## Conclusion

The local pCAD/Brepia Supabase lifecycle is managed by the **repository-local Supabase CLI through `npx`**.

The earlier documentation saying that **NOx** owned the Supabase lifecycle was incorrect. Workstation inspection on 2026-08-30 found no `nox`/`NOx` executable, service, launcher or configuration. The user also identified the likely origin: `NOx` was accidentally written in an earlier conversation when `npx` was intended.

Treat historical references to NOx as a documentation typo for `npx`, not as a real project dependency.

## Workstation evidence

Inspection was run from `/home/thn/ai/pCAD` on `feature/post-merge-functionality`.

Observed command/runtime state:

- no `nox` command found;
- no `NOx` command found;
- no globally installed `supabase` command found;
- `podman` is `/usr/bin/podman`;
- Node/npm/npx are installed under `~/.local/bin`;
- rootless user `podman.socket` is active;
- repository-local Supabase CLI version is `2.114.0`;
- repository-local `supabase status` detects the running local stack.

Observed running Supabase stack:

- container names follow the standard `supabase_*_cadam` convention;
- all inspected containers carry `com.supabase.cli.project=cadam`;
- all inspected containers carry `com.docker.compose.project=cadam`;
- database, analytics, vector, Kong, auth, mail, realtime, REST, storage, edge runtime, pg-meta and Studio containers were present;
- the stack was healthy enough for the repository-local Supabase CLI to detect it normally.

Other artifacts found during the investigation:

- `postgres.service` exists as a generated user unit with description `Supabase PostgREST`, uses `/usr/bin/podman`, and was in `failed/failed` state while the actual Supabase stack remained healthy;
- `~/.config/supabase.env` exists and contains Supabase-related key names such as `ANON_KEY`, `JWT_SECRET`, `POSTGRES_PASSWORD` and `SERVICE_ROLE_KEY`;
- neither artifact is required to explain ownership of the healthy `cadam` CLI/Compose stack and neither provides evidence for a separate NOx lifecycle manager.

## Canonical local workflow

### Normal Brepia startup

Use:

```bash
./start.sh
```

`start.sh` owns the local bootstrap sequence required by this workstation:

1. enable/start the rootless user `podman.socket`;
2. set `DOCKER_HOST` to the rootless Podman socket;
3. prepend `scripts/podman/` to `PATH` so the Supabase CLI works with the installed Podman version;
4. check the `cadam` stack with `npx supabase status`;
5. if the stack is not running, start it with `npx supabase start`;
6. read local Supabase connection values from `npx supabase status -o env` without printing credentials;
7. continue with the normal Brepia startup flow.

Supabase is intentionally not stopped when Brepia exits; the local database stack is a persistent development service.

### Explicit lifecycle commands

When operating Supabase directly from a terminal, configure the same rootless Podman environment used by `start.sh`:

```bash
systemctl --user enable podman.socket --now
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
export PATH="$PWD/scripts/podman:$PATH"
```

Then use the repository-local CLI:

```bash
npx supabase start
npx supabase status
npx supabase stop
```

A global `supabase` installation is not required.

## Declarative database workflow

With the local stack running:

```bash
# 1. Edit supabase/schemas/*.sql

# 2. Generate and review a migration
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
- review generated migrations before applying them.

The detailed schema rules live in `.cursor/rules/database-workflow.mdc`.

## Recovery / troubleshooting

If `./start.sh` cannot see or start the local stack:

1. confirm `podman.socket` is active;
2. confirm `DOCKER_HOST` points to `unix:///run/user/$(id -u)/podman/podman.sock`;
3. confirm `scripts/podman` is prepended to `PATH`;
4. run `npx supabase status` from the repository root;
5. if needed, run `npx supabase start`;
6. use `bash scripts/inspect-local-supabase-lifecycle.sh` for a read-only inventory of relevant commands, units and containers.

The diagnostic helper intentionally avoids printing Supabase credential values.

## Historical correction

Several Brepia phase/checkpoint documents created around 2026-08-27 mention NOx. Those statements reflected the same mistaken operating note and are superseded by this document, `AGENTS.md`, `README.md`, `.cursor/rules/database-workflow.mdc`, and the current `start.sh` behavior.
