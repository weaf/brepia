# Phase B — Foundation Hardening closeout

Date: 2026-09-23

Status: **IMPLEMENTED / VERIFIED ON HARDENING BRANCH — READY FOR INTEGRATION**

Branch: `hardening/foundation-b1`

Current checkpoint:

`de7f486d041460aaf6aef85e2a1615935ae0bf03`

Draft integration PR:

`#52`

## Decision

Phase B Foundation Hardening is complete on `hardening/foundation-b1`.

The accepted Phase A findings that were promoted into Foundation Hardening have been addressed as independently bounded packages. No additional accepted blocking hardening item remains before Product Template Foundation.

The remaining dependency item `A-DEP-001` is deliberately retained as maintenance backlog and is not a template blocker.

No new BRep capability or product-template implementation was introduced during this phase.

## Closed packages

### B1.1 — Conversation state integrity

Finding:

`A-STATE-001`

Checkpoint:

`da6042ae`

Result:

- generic conversation metadata writes no longer replay stale `current_message_leaf_id`;
- title/privacy/settings writes use narrow patch semantics;
- focused race/regression evidence passed.

Reference:

`docs/brepia_b1_1_conversation_state_integrity_2026-09-22.md`

### B1.2 — Executable core RLS regression gate

Finding:

`A-SEC-004`

Checkpoint:

`eed9658a`

Result:

- core conversation persistence has an executable owner/public/RLS regression gate;
- owner-only preview behavior remains protected.

Reference:

`docs/brepia_b1_2_rls_regression_2026-09-22.md`

### B1.3 — Dependency and warning hygiene

Finding:

`A-DEP-001`

Checkpoints:

`835c7ee8`
`991a4afa`

Result:

- no demonstrated security/runtime/compatibility reason justified broad dependency churn;
- package and lockfile versions were intentionally left unchanged;
- `A-DEP-001` remains maintenance backlog rather than a Product Template Foundation blocker.

Reference:

`docs/brepia_b1_3_dependency_hygiene_2026-09-22.md`

### B2A — Acceptance port ownership

Finding:

`A-RUN-002`

Checkpoint:

`7f4f48ee`

Result:

- browser-smoke owns an explicit test port;
- invalid values fail at configuration;
- unrelated listeners cannot be silently reused;
- Vite remains strict-port.

Reference:

`docs/brepia_b2a_acceptance_port_ownership_2026-09-23.md`

### B2B — Immutable stable runtime artifact

Finding:

`A-RUN-001`

Checkpoint:

`0c683ff3`

Result:

- stable production-like runtime owns a unique per-launch Nitro/Vite artifact;
- later worktree builds cannot replace files beneath the running stable runtime;
- artifact-isolation regression evidence passed.

Reference:

`docs/brepia_b2b_immutable_stable_runtime_artifact_2026-09-23.md`

### A-RUN-003 — Local Supabase runtime isolation

Checkpoint:

`8120cc63`

Result:

- Brepia owns checkout-local Supabase host ports;
- rootless Podman Realtime startup no longer depends on container-name DNS availability;
- five clean stop/start cycles passed;
- Realtime remained healthy;
- Noty containers were unchanged.

Reference:

`docs/brepia_arun003_local_supabase_runtime_isolation_2026-09-23.md`

### A-CI-001 — Always-present Grasshopper interoperability gate

Implementation checkpoint:

`42ec7a62`

Assertion-hardening checkpoint:

`ebacf737`

Documentation checkpoint:

`de7f486d`

Result:

- every PR receives `grasshopper-interoperability`;
- relevant changes run plugin and Ubuntu/Windows package builds;
- non-relevant changes skip expensive jobs while retaining a green final gate;
- both relevant and non-relevant paths are proven;
- `master` branch protection now requires both:
  - `quality`;
  - `grasshopper-interoperability`.

Reference:

`docs/brepia_aci001_grasshopper_merge_gate_2026-09-23.md`

## Exact branch verification

At checkpoint:

`de7f486d041460aaf6aef85e2a1615935ae0bf03`

PR `#52` reports:

- `Quality Gate` — **PASS**;
- `Grasshopper Build` — **PASS**.

The branch therefore has a green repository CI checkpoint after all currently committed hardening work.

## Retained debt and non-blockers

### A-DEP-001

Dependency/toolchain modernization remains maintenance backlog.

Current evidence does not justify broad package churn before template work. Revisit when driven by:

- a security advisory;
- unsupported/deprecated runtime behavior;
- a concrete compatibility defect;
- a recurring warning with operational cost;
- or a bounded maintainability/performance benefit.

### Historical roadmap status text

The original maturity/productization roadmap still describes Phase A/Phase B as planned because it is the planning authority from before implementation.

This closeout records the realized implementation state and supersedes those historical status labels for the completed Foundation Hardening work.

### A-CI-001 integration transition

The always-present Grasshopper workflow is currently on `hardening/foundation-b1`.

Although `master` already requires `grasshopper-interoperability`, that policy becomes a permanent coherent baseline only when PR `#52` (or an equivalent verified integration containing the same workflow contract) lands on `master`.

Do not remove or bypass the required check during that transition.

## Phase B exit assessment

Phase B exit target from the maturity roadmap was:

> Establish a new stable baseline that can be described as the accepted product-platform foundation on which reusable product templates are built.

The hardening branch now satisfies that target from the accepted findings set:

- application state integrity hardened;
- core RLS path regression-tested;
- dependency churn explicitly bounded;
- browser acceptance port ownership hardened;
- stable runtime artifact ownership isolated;
- local Supabase runtime isolated;
- interoperability CI made globally requireable;
- exact branch CI green.

No currently accepted Phase A finding requires another Foundation Hardening implementation package before Phase C.

## Next phase

After integration of the hardening branch into `master`, the next planned activity is:

`Phase C — Product Template Foundation`

The first task should be a fresh reconciliation/design pass for template identity and versioning before persisted schema or UI implementation begins.

No product pack or new BRep capability should begin ahead of that template-foundation design.
