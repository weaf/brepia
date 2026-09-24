# Local Supabase lifecycle

The local Brepia database stack is managed by the repository-local Supabase CLI through `npx`.

Brepia intentionally pins the CLI to `2.114.0` while the Dquark workstation uses rootless
Podman 4.9.x. Supabase CLI 2.115+ streams container secret tar archives through the
Docker-compatible socket, which triggers a known broken-pipe incompatibility in this older
Podman/Buildah copier path. Keep this pin until the workstation runtime is upgraded to a
Podman/Buildah release containing the copier stream-drain fix; do not widen the version range
without re-running the live local-stack gate.

## Normal startup

Use:

```bash
./start.sh
```

`start.sh` performs the workstation bootstrap required by the project:

1. enables the rootless user `podman.socket`;
2. sets `DOCKER_HOST` to the rootless Podman socket;
3. prepends `scripts/podman/` to `PATH` for Supabase CLI compatibility with the installed Podman version;
4. checks the local stack with `./scripts/supabase-local.sh status`;
5. starts it with `./scripts/supabase-local.sh start` when needed;
6. reads local connection values from `./scripts/supabase-local.sh status -o env` without printing credentials;
7. continues with normal Brepia startup.

Supabase is intentionally left running when Brepia exits so the local database remains a persistent development service.

On the current rootless Podman 4.9.x workstation, Realtime startup can race Podman DNS registration for `supabase_db_brepia`. Brepia avoids that race deterministically through the repository-owned `scripts/podman/podman` compatibility shim. Only a Brepia Realtime `podman create` whose CLI-provided `DB_HOST` is `supabase_db_brepia` is specialized: the shim reads the already-running database container's IPv4 address, passes that numeric address as `DB_HOST`, and adds `DB_IP_VERSION=ipv4`. All other Podman calls delegate unchanged to `/usr/bin/podman`. There is no startup retry loop, Noty's containers are outside this project-scoped path, and the Brepia cleanup path never removes persistent volumes.

Brepia currently has no repository-owned Supabase Edge Functions, so the local Edge Runtime service is disabled in `supabase/config.toml`. Enable it only when Brepia adds an actual local Edge Function, and include that change in local-runtime verification.

The local Supabase Analytics/Logflare service is also disabled because Brepia has no product dependency on local Logs Explorer. This keeps the rootless Podman stack smaller and avoids introducing an operational dependency on an unused logging service.

## Explicit lifecycle commands

When operating Supabase directly from a terminal, configure the same rootless Podman environment used by `start.sh`:

```bash
systemctl --user enable podman.socket --now
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
export PATH="$PWD/scripts/podman:$PATH"
```

Then use the repository-local CLI:

```bash
./scripts/supabase-local.sh start
./scripts/supabase-local.sh status
./scripts/supabase-local.sh stop
```

A global `supabase` installation is not required.

## Declarative database workflow

With the local stack running:

```bash
# 1. Edit supabase/schemas/*.sql

# 2. Generate and review a migration
./scripts/supabase-local.sh db diff -f <migration_name>

# 3. Apply pending local migrations
./scripts/supabase-local.sh migration up

# 4. Regenerate checked-in database types
./scripts/supabase-local.sh gen types typescript --local > shared/database.ts
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
4. run `./scripts/supabase-local.sh status` from the repository root;
5. if needed, run `./scripts/supabase-local.sh start`;
6. use `bash scripts/inspect-local-supabase-lifecycle.sh` for a read-only inventory of relevant commands, units and containers.

The diagnostic helper intentionally avoids printing Supabase credential values.
