# Pre-Phase-D Technical Readiness Review

Date: 2026-09-25

Status: **READY — PRE-PHASE-D TECHNICAL BASELINE ACCEPTED ON REVIEW BRANCH**

Review branch:

`review/pre-phase-d-technical-readiness-20260925`

Baseline master:

`a94c4da3c95c43b8b31905457165912962869555`

`Merge PR #58: Close Phase C5 template validation`

## Purpose

This review decides whether the accepted Phase B/C platform is technically ready to carry the first real repository-owned product families without first opening another speculative modeling or platform phase.

Phase D product implementation is intentionally not part of this review.

No Electrical Cabinet, Cable Tray, Cable Conduit/Pipe template or new BRep modeling capability is introduced here.

## Reconciled baseline

The remote `master` HEAD was re-verified at review start and still matched the handover baseline exactly.

On that exact merge commit, GitHub reports:

- `quality` — success;
- `grasshopper-interoperability` — success;
- Grasshopper plugin/package jobs correctly skipped because the C5 merge did not touch an interoperability-relevant path.

The protected-check policy is separately verified through Dquark because the GitHub App connector does not have branch-administration permission to read the protection endpoint directly.

Accepted roadmap state at review start:

`C1–C5 COMPLETE; C6 DEFERRED; PHASE D NEXT`

Phase B Foundation Hardening remains complete.

## Review scope

The review covered the current authority and lifecycle boundaries around:

- canonical `BrepProject` source;
- build123d/OCCT evaluation;
- M0 integrity and bounded scalar expressions;
- immutable message/revision persistence;
- template identity, catalog, provenance, materialization and validation;
- STEP export and exact native re-import evidence;
- Rhino/Grasshopper compilation and return boundaries;
- Supabase/RLS regression coverage;
- package/toolchain state;
- repository quality and browser-smoke workflows;
- active compatibility layers and obvious TODO/FIXME/HACK/dead-code indicators;
- Phase D acceptance requirements.

Historical plans were treated as evidence, not current work orders.

## Executive technical assessment

The core architecture remains coherent after Phase B and C.

The review did **not** find a second geometry authority or a template-specific project mode. A created template instance becomes an ordinary independently persisted BRep project. Native evaluation remains isolated behind build123d/OCCT. STEP remains the exact CAD export authority. Rhino/GHX remains an interoperability path. Raw kernel topology identities are not persisted as canonical source.

Two concrete A-findings were identified:

1. the C5 repository catalog gate could remain green for a future real template without actually invoking the native evaluator for that shipped catalog entry;
2. BRep project creation rolled back a failed message insert but did not roll back a failure during final leaf activation.

Both have bounded code fixes on the review branch and are green.

A later apparent branch-protection finding was invalidated: the original Dquark Maintenance probes used an invalid lock scope and failed before executing the GitHub query. Corrected Maintenance run `36192531214` verified the accepted `master` policy remains intact: strict status checking is enabled and both `quality` and `grasshopper-interoperability` are required GitHub Actions checks.

No review evidence currently justifies a new BRep capability, schema migration, assembly engine, broad dependency upgrade or user-template system before Phase D.

---

# Authority-boundary review

## Canonical source and geometry authority

Accepted and preserved:

- `BrepProject` remains the persisted canonical model/geometry source;
- evaluator output is derived data, not editable source authority;
- build123d/OCCT remains the native exact-geometry authority;
- `resultNodeId` remains the primary canonical result authority;
- project-object geometry roles remain auxiliary semantics;
- viewer meshes remain presentation artifacts;
- exact STEP is generated from authoritative native evaluation;
- Rhino/GHX is an interoperability compiler/round-trip surface rather than an alternative Brepia geometry authority.

No parallel template geometry representation was found.

## Immutable revisions

Accepted and preserved:

- canonical BRep source snapshots remain immutable assistant-message artifacts;
- `current_message_leaf_id` selects active branch/source state;
- parameter/source edits create new immutable revisions;
- compare-and-set activation prevents stale edits from replacing a newer active leaf;
- historical snapshots are normalized before becoming executable/viewable;
- UI removal of revisions hides history rather than physically deleting lineage nodes.

## Template lifecycle

Accepted and preserved:

`exact template id/version -> normalized materialized BRep snapshot -> fresh project/conversation identity -> persisted provenance -> ordinary project lifecycle`

After creation:

- the project view does not consult the product-template catalog;
- parameter/source revision persistence has no template-catalog dependency;
- provenance remains descriptive/audit metadata;
- no automatic template upgrade or hidden catalog coupling exists.

This is the correct boundary for Phase D.

## Template identity/provenance

Accepted and preserved:

- built-in template family identity and immutable integer version are separate from BRep schema version;
- exact-version lookup is required;
- source SHA-256 provenance follows the canonical snapshot actually persisted;
- normalized template-definition identity is deterministic;
- creation does not resolve a later/latest version after discovery.

## M0 and scalar/expression semantics

Accepted and preserved:

- M0 uses one shared integrity implementation;
- result/role reachability determines authoritative feature reachability;
- published parameters are classified as effective, semantic-only, orphan-only or unused;
- C5 rejects orphan graph content and visible controls that are not structurally effective;
- scalar expressions remain bounded by depth/node count;
- dimensional compatibility remains explicit;
- runtime evaluation rejects non-finite/overflow/division-by-zero values.

No second template-only expression engine or integrity implementation was found.

## Raw topology identities

No persisted raw OCCT/build123d/Rhino face or edge indices were found in the canonical BRep schema.

Runtime Rhino compilation may use transient Rhino edge indices while implementing a semantic canonical selector. Tests also contain deliberately invalid `edgeIndex` fixtures to prove rejection. These are not persisted topology authority.

---

# Findings

## A-001 — Real built-in template native validation was not enforced by the repository catalog gate

Classification: **A — fix before Phase D**

### Evidence

Before this review:

- `tests/builtinProductTemplateValidation.test.ts` iterated every shipped catalog entry only through `validateBuiltinProductTemplateStatic()`;
- `validateBuiltinProductTemplateNative()` existed and correctly reused the authoritative native evaluator;
- its Vitest coverage used a fake runner fixture;
- `scripts/brep/c5-template-validation-smoke.sh` proved the native boundary with a synthetic fixture, not each future catalog entry;
- ordinary branch-protected `quality` did not execute a real native validation for each shipped catalog template.

The C5 closeout deliberately required product-specific native/export evidence in Phase D. The weakness is enforceability: a product PR could add a catalog entry, satisfy the static catalog gate and protected repository CI, yet omit the promised native product evidence.

That is a false-green path at exactly the transition from template foundation to real products.

### Fix

Added:

`tests/builtinProductTemplateNativeValidation.test.ts`

The test routes **every shipped exact catalog entry** through:

`validateBuiltinProductTemplateNative()`

Current catalog is empty, so the accepted Phase C baseline stays lightweight.

When the first Phase D template is added, normal repository tests become fail-closed unless an authoritative `PCAD_BREP_RUNNER` is available. The first product PR must therefore wire/provide its native evaluator acceptance rather than silently omitting it.

This does not add a new geometry implementation.

### Remaining verification

Final review-branch quality must pass while the catalog is empty.

The first Phase D slice must prove the non-empty path with the pinned native runtime.

---

## A-002 — BRep project creation could report failure while leaving a created project behind

Classification: **A — fix before Phase D**

### Evidence

`createBrepProjectConversation()` performs:

1. conversation insert;
2. baseline message insert;
3. explicit final `current_message_leaf_id` activation.

The message-insert error path deleted the newly created conversation.

The final leaf-activation error path previously threw directly without equivalent cleanup.

Because conversation -> messages uses `ON DELETE CASCADE`, the service already had a safe bounded rollback primitive available.

A failure at step 3 could therefore leave the project/conversation and baseline rows persisted while the caller received an error. Retrying creation could create a duplicate project.

This affects scratch/import creation as well as template creation.

### Fix

The final leaf-error path now deletes the just-created conversation, scoped by both conversation id and user id, before rethrowing the original activation error.

The FK cascade removes the baseline messages.

Added regression coverage in:

`tests/brepProjectTemplateCreation.test.ts`

The test proves final leaf activation failure triggers the cleanup path.

No schema change or lifecycle redesign was introduced.

---

## B-001 — Executable core RLS regression is not part of branch-protected ordinary quality

Classification: **B — fix when persistence/RLS surface is next changed**

### Evidence

Phase B correctly added:

`npm run test:rls`

covering owner/other-user/anonymous access across conversations, messages, images, meshes, previews and the narrow metadata RPC.

The ordinary `quality` workflow does not start a local Supabase runtime or execute that script.

Therefore RLS is executable and has accepted Phase B evidence, but it is not continuously proven by the branch-protected `quality` context.

### Why this does not block pure Phase D template work

D1–D3 built-in templates can use the already accepted conversations/messages persistence surface without changing schema, policies or RPCs.

No Phase D product template should require a database migration.

### Trigger

If a Phase D slice changes:

- Supabase schema;
- RLS policy;
- conversation/message persistence;
- ownership/privacy behavior;
- project-origin persistence semantics;

then the RLS gate must be rerun and the affected security path should be made merge-enforced as part of that change.

A speculative Supabase-CI expansion is not justified solely to add repository-owned geometry templates.

---

## B-002 — C5 “effective control” is structural effectiveness, not measured geometry delta

Classification: **B — fix/prove per product**

### Evidence

M0/C5 classifies a parameter as effective when it is referenced by authoritative reachable geometry.

That is the correct deterministic static definition for repository validation.

It does not prove that two selected numeric values produce meaningfully different native geometry in every product-specific configuration. Boolean cancellation, degenerate value combinations or an accidentally ineffective selected operating range are product-level concerns.

### Required Phase D acceptance

For every visible product control that matters to the product contract, Phase D acceptance should evaluate at least one non-default valid value and prove authoritative native output changes as intended.

This belongs with the real product geometry, not as a speculative general symbolic/geometric equivalence engine.

---

## B-003 — Authenticated create/reload/edit/export browser acceptance is product-specific today

Classification: **B — add with the first real product template**

### Evidence

The branch-protected generic browser smoke currently proves:

- sign-in renders without client crash;
- protected deep links redirect correctly;
- legacy base-path canonicalization works.

C4 project lifecycle is covered mostly through focused unit/source-contract tests with mocked Supabase.

That is appropriate while the shipped template catalog is empty, but a real D1 product should add one end-to-end acceptance path covering:

`discover -> create exact version -> ordinary project route -> reload -> parameter edit -> revision persistence -> native preview/export`

This is best added against the first real product rather than a synthetic UI fixture.

---

## B-004 — Product-specific native/export stress should follow actual geometry complexity

Classification: **B — prove with affected product**

The generic native evaluator and exact STEP re-import path are already accepted.

More complex Phase D geometry may expose:

- Boolean tolerancing;
- large graph/evaluation cost;
- instance-set cardinality;
- STEP size/re-import behavior;
- product-specific parameter extremes.

Do not invent generalized capabilities now. Add focused stress fixtures only where D1/D2/D3 actually exercise those risks.

---

## C-001 — Broad dependency modernization remains deferred

Classification: **C — defer**

Phase B dependency reconciliation is only days old and recorded:

- Node/npm within declared engines;
- lockfile v3;
- `npm audit` with 0 vulnerabilities at that checkpoint;
- current-range updates available;
- several substantial major migrations available;
- no demonstrated runtime/security defect requiring churn.

Current repository workflows use current action majors and fail lint on warnings.

No evidence found in this review justifies a broad package update before D1.

Revisit only for:

- security advisory;
- unsupported/deprecated runtime;
- demonstrated compatibility defect;
- recurring operational warning;
- bounded product-required benefit.

In particular, do not use Phase D as an excuse to combine product work with AI SDK, Three, Zod, Vitest, Tailwind, Sentry or similar major migrations.

---

## C-002 — Active “Legacy” BRep implementation files are layering, not dead code

Classification: **C — do not refactor now**

Examples:

- `shared/brepGrasshopperRhinoScriptLegacy.ts`;
- `src/components/brep/BrepFeatureEditorLegacy.tsx`.

Both remain actively imported by newer wrapper/extension layers.

The newer Rhino script layer reuses the established compiler and replaces only the multi-loop extrusion blocks. The feature editor wrapper similarly composes the established editor with the newer multi-loop editor.

The naming is historical, but the code is not dead.

A consolidation could be reasonable during future work in those modules, but doing it now would create regression surface without reducing Phase D risk.

---

## C-003 — Non-product platform expansion remains deferred

Classification: **C — defer**

Continue to defer unless a concrete product proves otherwise:

- user-created/shared template marketplace;
- automatic template upgrade machinery;
- generic assembly engine;
- shell/thickness solely for concision;
- richer topology naming solely for future possibilities;
- arbitrary sweep/revolve expansion;
- new raw topology identity;
- broad compatibility-layer removal.

The existing deferred-capability inventory remains the correct authority.

---

# Code-quality review

No material TODO/FIXME/HACK marker was found in the relevant production BRep/template path.

The largest BRep/Rhino/editor modules are not small, but they currently encode mature cross-backend contracts with extensive regression evidence. File size alone is not a reason to refactor before product work.

Several compatibility casts/adapters exist elsewhere in the application, including database-type lag and historical OpenSCAD/UI compatibility. None reviewed here creates a second BRep/template authority.

Error handling is generally fail-closed at geometry and normalization boundaries.

The material project-creation rollback gap is A-002 and has been addressed.

---

# Dependency/toolchain assessment

Current declared toolchain remains coherent:

- Node engine: `^20.19.0 || >=22.12.0`;
- npm: `>=10`;
- TypeScript: current repository-pinned 5.8.x line;
- Vite 8 line;
- React 19 line;
- TanStack Start/Router current repository ranges;
- Supabase JS/CLI repository ranges;
- Playwright 1.62.x line;
- Vitest 4 line;
- pinned native CAD runtime:
  - build123d `0.11.1`;
  - cadquery-ocp-novtk `7.9.3.1.1`;
  - rhino3dm `8.32.1`.

The native CAD versions are intentionally pinned acceptance authorities, not ordinary “outdated package” candidates.

No major dependency upgrade is authorized by this review.

---

# Test and CI architecture

## Strong existing coverage

Repository quality currently covers:

- unit/shared contracts via Vitest;
- canonical BRep normalization and validation;
- M0/scalar semantics;
- AI/source identity contracts;
- revision/persistence service behavior;
- template identity/catalog/materialization/static validation;
- build/typecheck/lint;
- generic browser smoke;
- diff cleanliness.

Separate accepted/native evidence covers:

- authoritative build123d/OCCT evaluation;
- exact STEP production;
- exact STEP re-import;
- numerous geometry-operation smokes.

Grasshopper has an always-present merge context:

`grasshopper-interoperability`

with expensive plugin/package jobs enabled only for relevant changes.

## Identified false-green surfaces

- future real built-in template native evaluation — **A-001 fixed with fail-closed catalog-native test**;
- RLS policy regression — **B-001, executable but not ordinary protected CI**;
- first real template browser lifecycle — **B-003, add with D1**.

---

# Persistence/data lifecycle assessment

## Accepted

- fresh project/conversation identity on materialization;
- immutable baseline source snapshot;
- exact template provenance retained;
- template catalog no longer needed after creation;
- normal revisions remain template-agnostic;
- CAS activation prevents stale parameter/source revisions from overtaking newer leaves;
- revision history remains immutable;
- owner-scoped Supabase/RLS boundary is unchanged.

## Corrected

- final project-creation leaf activation now has rollback symmetry with message insertion — A-002.

No schema migration is required by the review fixes.

---

# Export/import/interoperability assessment

## STEP

STEP remains the exact native CAD export.

The native result boundary requires exact export availability and bounded artifact bytes.

C5 already demonstrated independent STEP re-import in the pinned build123d/OCCT environment.

## Viewer mesh

Viewer geometry remains derived presentation data and is not reused as exact CAD authority.

## 3DM / Rhino / GHX

The existing HTTP export route intentionally multiplexes STEP and 3DM using content negotiation; this is not a duplicate geometry authority.

3DM/GHX remains explicitly interoperability-oriented.

The active Rhino compiler can use transient runtime topology identifiers internally while canonical selectors remain semantic.

No review evidence requires Rhino/Grasshopper to become mandatory infrastructure for ordinary native BRep project execution.

---

# Phase D readiness by product

## D1 — Electrical Cabinet

Recommended first slice after this review closes.

Reason:

- the repository already has a long-lived representative cabinet fixture and cabinet-shaped acceptance history;
- it exercises dimensions, Boolean structure, openings/features, revisions, native export and template lifecycle without first requiring a new geometry primitive;
- it is therefore the best first proof that C1–C5 works as a product system rather than just a framework.

Do **not** simply publish the historical sample unchanged.

The D1 slice should first define the customer-facing parameter contract, presentation metadata, defaults/ranges and exact product acceptance fixture, then add the built-in catalog entry.

## D2 — Cable Tray

Start only after D1 proves the full product-template lifecycle.

Use existing BRep operations where practical.

Add a new capability only if the concrete tray geometry/acceptance fixture proves the current language materially inadequate.

## D3 — Cable Conduit / Pipe

Likewise defer capability expansion until the concrete conduit fixture demonstrates a real gap.

The existing bounded sweep capability is a plausible foundation, but the product should decide whether it is sufficient.

---

# Required Phase D first-slice acceptance

The first D1 pull request should prove, in one bounded product slice:

1. exact built-in id/version identity;
2. static C5 validation;
3. the new catalog-wide native validation gate on the actual D1 entry;
4. pinned build123d/OCCT evaluation;
5. non-default parameter reevaluation;
6. exact STEP export and re-import;
7. create from discovered exact version;
8. reload as ordinary independent project;
9. immutable parameter revision;
10. template provenance remains audit metadata only;
11. no post-creation catalog dependency;
12. protected `quality` and `grasshopper-interoperability` remain green.

Installed Rhino/GHX acceptance is needed only if D1 changes or makes a new claim about that interoperability boundary.

---

# Readiness status

Current review-branch status:

**READY — Brepia has an accepted technical baseline for Phase D First Product Pack.**

The platform does not need another general modeling phase before D1 based on current evidence.

Readiness becomes:

> Brepia has an accepted technical baseline for Phase D First Product Pack.

when:

- A-001 and A-002 pass final isolated repository quality — **PASS**;
- PR #59 `quality` and `grasshopper-interoperability` pass on the exact review head — **PASS**;
- `master` branch protection requires both `quality` and `grasshopper-interoperability` with strict status checking — **PASS**, verified by Maintenance run `36192531214`.

No B/C item above blocks that declaration.
