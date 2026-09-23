# A-RUN-003 — Local Supabase runtime isolation

Date: 2026-09-23

Status: **CLOSED**

Branch: `hardening/foundation-b1`

Accepted base before this package:

`0c683ff32f59f5a17b75d160b12ed67d5b0a9045`

`Isolate stable runtime build artifacts`

## Finding

Brepia and Noty previously competed for the historical fixed local Supabase host ports. Brepia also encountered an intermittent rootless Podman 4.9.3 startup race in Supabase Realtime: Realtime could begin while the database container name `supabase_db_brepia` was not yet resolvable and fail with `NXDOMAIN`.

Realtime is product-required and remains enabled.

## Change

A-RUN-003 gives Brepia repository-owned local Supabase runtime isolation:

- `scripts/supabase-local.sh` owns a checkout-local port bundle in `.brepia/supabase-ports.env`;
- all host-facing Supabase ports in `supabase/config.toml` read that bundle through `env(BREPIA_SUPABASE_...)`;
- runtime/test callers use the repository wrapper instead of assuming port `54321`;
- Brepia cleanup is limited to containers labelled `com.supabase.cli.project=brepia`;
- persistent Supabase volumes are never removed by automatic cleanup;
- the Supabase CLI is pinned exactly to `2.114.0` for rootless Podman 4.9.3 compatibility;
- local Analytics/Logflare and Edge Runtime remain disabled because Brepia does not currently depend on them;
- the repository-owned `scripts/podman/podman` shim removes the Realtime DNS race without retrying startup.

For the Realtime create path only, when the CLI supplies `APP_NAME=realtime` and `DB_HOST=supabase_db_brepia`, the shim reads the running database container's numeric IPv4, passes it as `DB_HOST`, and injects `DB_IP_VERSION=ipv4`. Every other Podman invocation delegates unchanged to `/usr/bin/podman`.

`[realtime].ip_version = "IPv4"` remains aligned with the same IPv4-only local runtime boundary, but Supabase CLI 2.114.0 uses that field for Realtime's Erlang network family; the shim is what supplies `DB_IP_VERSION=ipv4` for the database connection.

## Rejected approaches

The following were investigated and are not part of the accepted solution:

- blind or unbounded startup retry;
- a single bounded retry after failed startup — reproduced the same NXDOMAIN failure;
- `[realtime].ip_version = "IPv4"` alone — CLI 2.114.0 did not emit `DB_IP_VERSION`;
- `supabase start -x realtime` followed by normal `start` — the CLI treated the partial stack as already running and did not add Realtime;
- `supabase db start` followed by normal `start` — the CLI likewise treated the DB-only state as already running.

## Runtime evidence

Earlier isolation evidence:

- Dquark run `35836159342`: API and DB on Brepia-owned dynamic ports, auth health `200`, Analytics/Vector absent, Noty remained at 12 running Supabase containers.
- Dquark run `35836652007`: DB and Realtime were on `supabase_network_brepia`; a successful start proved the prior failure was an intermittent startup/DNS race rather than a permanently wrong network.
- Dquark run `35836897280`: bounded retry experiment reproduced Realtime NXDOMAIN on both initial start and retry.
- Dquark run `35837434568`: `[realtime].ip_version = "IPv4"` did not produce `DB_IP_VERSION=ipv4`.

Accepted deterministic Realtime gate:

Dquark Maintenance run `35845752689` executed five clean Brepia Supabase stop/start cycles.

Every cycle proved:

- the Realtime container received the current database container's numeric IPv4 as `DB_HOST`;
- `DB_IP_VERSION=ipv4` was present;
- Realtime health was `healthy`;
- Realtime logs contained no `NXDOMAIN`;
- auth health returned `200`.

The database IPv4 changed across the five cycles (`10.89.5.187`, `.196`, `.205`, `.214`, `.223`), demonstrating that the shim resolves the current runtime-owned address rather than relying on a fixed value.

The exact set of 12 running Noty Supabase container IDs/names was identical before and after the gate.

Result: **PASS**.

## Boundary

A-RUN-003 closes local Supabase runtime/port isolation and the rootless-Podman Realtime startup race only.

It does not change:

- canonical BRep/schema authority;
- native sandbox semantics;
- STEP export authority;
- Rhino/GHX interoperability boundaries;
- product templates;
- BRep capabilities;
- blanket dependency modernization;
- CI merge-gate policy.

`A-CI-001` remains a separate next hardening item and must not begin until this A-RUN-003 checkpoint is accepted.
