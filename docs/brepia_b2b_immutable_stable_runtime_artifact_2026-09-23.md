# B2B — Immutable stable runtime artifact

Date: 2026-09-23

Status: **CLOSED**

## Problem

The stable launcher previously ran `npm run build` in the repository worktree and then served the resulting Nitro/Vite production preview from that same mutable build location.

A later production build in the same worktree could therefore replace files underneath an already-running stable runtime.

This was Phase A finding `A-RUN-001`.

## Change

The stable runtime now owns an isolated per-launch build artifact.

- `start.sh` creates a unique temporary artifact directory before the stable production build.
- `PCAD_STABLE_ARTIFACT_DIR` is exported only for the stable build/runtime path.
- `vite.config.ts` directs Nitro output to `<artifact>/nitro` when that variable is present.
- normal repository builds keep the existing default output behavior.
- the stable artifact remains owned by the launcher for the lifetime of the runtime and is removed during launcher cleanup.
- the HMR/development path is unchanged.

The isolated Nitro artifact contains the runtime-owned `public`, `server` and `nitro.json` outputs.

## Regression coverage

`scripts/runtime/test-stable-artifact-isolation.sh` verifies the ownership contract end to end:

1. build stable runtime into an isolated artifact;
2. start production preview from that artifact;
3. record the artifact hash;
4. run a separate normal production build in the same worktree;
5. verify the running preview still responds;
6. verify the stable artifact hash is unchanged.

Dquark/Herdr job:

`brepia-b2b-artifact-isolation-20260923-03`

Result: **PASS**

Artifact hash after the unrelated worktree build:

`8c74be00fd490e3e0fc6fa3d894be66e96a8e977f9726ba4161eed6a7d3f7e90`

## Boundary

B2B closes stable runtime artifact ownership only.

It does not change:

- the normal development/HMR workflow;
- acceptance port ownership covered by B2A;
- Supabase fixed local port ownership from `A-RUN-003`;
- CI merge-gate policy;
- generated database types;
- SSRF policy.

Those remain separate hardening items.
