# Local Supabase lifecycle

The local Brepia database stack is managed by the repository-local Supabase CLI through `npx`.

## Normal startup

Use:

```bash
./start.sh
```

`start.sh` performs the workstation bootstrap required by the project:

1. enables the rootless user `podman.socket`;
2. sets `DOCKER_HOST` to the rootless Podman socket;
3. prepends `scripts/podman/` to `PATH` for Supabase CLI compatibility with the installed Podman version;
4. checks the local stack with `npx supabase status`;
5. starts it with `npx supabase start` when needed;
6. reads local connection values from `npx supabase status -o env` without printing credentials;
7. continues with normal Brepia startup.

Supabase is intentionally left running when Brepia exits so the local database remains a persistent development service.

## Explicit lifecycle commands

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

Project policy:

- do not use `db push` in the normal local workflow;
- do not use `db pull` in the normal local workflow;
- do not hand-edit `shared/database.ts`;
- review generated migrations before applying them.

The detailed schema rules live in `.cursor/rules/database-workflow.mdc`.

## Recovery and troubleshooting

If `./start.sh` cannot see or start the local stack:

1. confirm `podman.socket` is active;
2. confirm `DOCKER_HOST` points to `unix:///run/user/$(id -u)/podman/podman.sock`;
3. confirm `scripts/podman` is prepended to `PATH`;
4. run `npx supabase status` from the repository root;
5. if needed, run `npx supabase start`;
6. use `bash scripts/inspect-local-supabase-lifecycle.sh` for a read-only inventory of relevant commands, units and containers.

The diagnostic helper intentionally avoids printing Supabase credential values.
