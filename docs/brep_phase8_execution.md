# BRep Phase 8 — GHX-native Grasshopper interoperability

## Status

Phase 8 is repository-complete and Brepia-side product-accepted for the strict v1 GHX subset on:

```text
feature/brep-grasshopper-gh-packaging
```

The detailed current product authority is `docs/grasshopper_roundtrip_architecture.md`. This execution document records completed implementation evidence and the revised Phase 8 slices that follow that architecture. Browser/product acceptance is recorded separately in `docs/brep_phase8h_browser_acceptance.md`.

A design pivot was agreed on 2026-09-06 after reviewing GHX/GH format behavior, Rhino 8 embedded Script components and related open tooling:

- GHX is the primary Grasshopper document interchange target;
- the user must see and revise the Brepia-generated 3D model in Brepia before Grasshopper is opened;
- the canonical Brepia/BRep model remains authoritative for Brepia-owned geometry and revisions;
- the preferred baseline is zero-install GHX using standard Grasshopper/Rhino 8 facilities, with embedded Script/C# Script where executable bridge logic is needed;
- a Brepia `.gha` is optional/reference/fallback rather than a baseline product requirement;
- initial GHX re-import is deliberately strict: recover supported Brepia parameter changes and provenance, but reject unsafe/unknown graph mutations rather than guessing;
- AI remains central to generation, interpretation and repair, but deterministic parsing/validation gates every accepted GHX artifact and every canonical round-trip update;
- Brepia is not a general Grasshopper automation product: broader scripting/logic may remain in Grasshopper, ChatGPT, Python or MCP-based workflows.

Repository-level Phase 8 is complete through 8G and the complete Brepia-side browser/product round trip is accepted as Phase 8H. Installed Rhino/Grasshopper runtime acceptance is not a blocking Phase 8 sub-step; it is tracked separately in `docs/brep_phase9_rhino_acceptance.md` and begins when a real Rhino 8 workstation is available.

## Target loop

```text
User intent
   |
   v
Brepia AI
   |
   v
canonical Brepia/BRep model
   |
   +----> Brepia evaluator ----> 3D preview + validation
   |
   +----> GHX compiler --------> editable model.ghx
                                  |
                                  v
                              Grasshopper
                                  |
                                  v
                              returned GHX
                                  |
                                  v
                    strict Brepia compatibility gate
                                  |
                         supported changes only
                                  |
                                  v
                         canonical Brepia model
                                  |
                                  v
                              Brepia AI
```

Grasshopper is a continuation environment, not the first place where Brepia-generated geometry becomes visible.

## Completed exploratory/reusable work before the GHX pivot

The work below remains valuable and is retained. It should not be interpreted as a requirement that the final product use a custom GHA component or Rhino-hosted `.gh` packager.

### 8A — deterministic package model and identity — repository complete

Implemented in `shared/brepGrasshopperPackagePlan.ts`:

- deterministic package plan derived from normalized Brepia contract;
- stable project/control identities across ordinary Brepia revisions;
- source revision retained as provenance rather than generated object identity;
- one generated control/wire per supported published numeric parameter;
- stable parameter-ID wiring;
- deterministic layout;
- no invented slider bounds;
- placement input left unconnected by default;
- no secrets in package state.

Accepted checkpoint:

```text
a033df76f054bf77c467118c8029a6a3eefe8f7e
```

Exact-head evidence:

- Quality Gate #468 — PASS;
- Grasshopper Build #44 — PASS.

### 8B — Rhino-hosted native GH object emission prototype — repository complete

This retained prototype proved native Grasshopper object creation through RhinoCommon/Grasshopper SDK code and remains useful reference/fallback work after the GHX pivot.

Accepted checkpoint:

```text
944f3b236ec16f54564d4feb045a3c3345208b3d
```

Exact-head evidence:

- Quality Gate #472 — PASS;
- Grasshopper Build #48 — PASS.

### 8C — package-plan transport — repository complete

Accepted checkpoint:

```text
86ce44428f196ab616f9c38fe37ff5d22be00023
```

Exact-head evidence:

- Quality Gate #483 — PASS;
- Grasshopper Build #59 — PASS.

### 8D — reconciliation research boundary — repository complete

Accepted checkpoint:

```text
fcc1e9ff589edc1a9570c4a6cddee79ef292ad7e
```

Exact-head evidence:

- Quality Gate #488 — PASS;
- Grasshopper Build #64 — PASS.

### 8E — GHX compiler + deterministic validator foundation — repository complete

Implemented deterministic portable GHX generation, bounded safe XML parsing, self-contained Rhino 8 C# Script, stable Brepia wiring and strict fail-closed returned-GHX validation. The currently proven executable geometry subset is deliberately exactly one canonical box result.

Accepted repository checkpoint:

```text
a44143ca31f29ba410f940ddbe7b6adbd525b782
Make GHX output mutation unambiguous
```

Exact-head evidence:

- Quality Gate #514 / run `34053885690` — PASS;
- Grasshopper Build #90 / run `34053885711` — PASS;
- portable test suite — PASS;
- TypeScript typecheck — PASS;
- lint — PASS;
- production build — PASS;
- `git diff --check` — PASS;
- Rhino/Grasshopper SDK plugin build — PASS;
- package build on `ubuntu-latest` — PASS;
- package build on `windows-latest` — PASS.

Evidence boundary:

- this proves the portable compiler/parser/validator contract and that retained Rhino/Grasshopper SDK code compiles on CI;
- it does **not** prove that the generated executable GHX has opened, compiled or solved inside an installed Rhino 8/Grasshopper host;
- real open/solve/parameter-change/save/reopen acceptance belongs to Phase 9 and must not be inferred from repository CI.

No embedded GHX viewer is required. The user can inspect exported files in Grasshopper. If something is wrong, they can return the GHX, describe the problem or provide screenshots for AI-assisted diagnosis.

### 8F — Brepia AI/product integration and preview parity — repository complete

The validated portable GHX boundary is integrated into the normal BRep project lifecycle without replacing or bypassing Brepia's native preview/evaluator.

Implemented:

- `src/services/brepGrasshopperExport.ts`
  - derives the Grasshopper contract from the saved canonical project and active immutable source revision;
  - compiles executable GHX entirely through the portable shared compiler;
  - requires no Rhino host, server-side Rhino runtime, GHA, token or additional export endpoint.
- `src/components/brep/BrepProjectEditor.tsx`
  - exposes `.GHX` as the user-facing editable Grasshopper export alongside STEP, 3DM and canonical BRep JSON;
  - removes the old contract-JSON product download from the export menu while retaining the contract internally as compiler infrastructure;
  - GHX uses the saved canonical source plus `activeRevisionId` provenance;
  - unsaved parameter preview values must be saved before canonical BRep/GHX export;
  - STEP and 3DM intentionally retain current-preview export semantics;
  - compiler errors for geometry outside the proven GHX subset surface through the existing project error path, and no approximate GHX is emitted.
- product tests prove that the existing cabinet fixture compiles to executable GHX and that an unsupported canonical transform graph fails closed with `unsupported_model`.

Accepted repository checkpoint:

```text
3c5b712403a7942af70f84b955732a89b29428ab
Keep Rhino preview export test layout-tolerant
```

Exact-head evidence:

- Quality Gate #520 / run `34054348470` — PASS;
- Grasshopper Build #96 / run `34054348472` — PASS;
- portable tests — PASS;
- TypeScript typecheck — PASS;
- lint — PASS;
- production build — PASS;
- `git diff --check` — PASS;
- Rhino/Grasshopper SDK plugin build — PASS;
- package build on `ubuntu-latest` — PASS;
- package build on `windows-latest` — PASS.

The current product integration deliberately does not claim GHX support for canonical node types outside the 8E-proven single-box subset. Those models remain fully usable in Brepia/native BRep preview and STEP/3DM export, while GHX export fails explicitly instead of silently changing geometry semantics.

### 8G — strict v1 GHX round-trip — repository complete

The first deliberately narrow product import contract is implemented.

Implemented:

- `src/services/brepGrasshopperImport.ts`
  - validates a returned GHX against the exact active canonical project and immutable source revision;
  - recovers only finite published numeric parameter values after the deterministic returned-GHX validator accepts the file;
  - preserves machine-readable diagnostics for unsupported graph/script/runtime changes.
- `src/services/brepGrasshopperImportLifecycle.ts`
  - enforces the 4 MiB file bound before browser `File.text()`;
  - creates no revision for an unchanged supported GHX;
  - normalizes accepted parameter changes through the canonical Brepia artifact path;
  - persists a new immutable branch revision without silently moving `current_message_leaf_id`.
- `src/components/brep/BrepGrasshopperImportButton.tsx`
  - provides the product-facing `Import GHX` control in the BRep workspace;
  - validates against the active revision provenance;
  - refreshes Revision history after a successful changed import;
  - leaves activation explicit so unsaved local preview state is not discarded.
- lifecycle/product tests cover parameter recovery, pre-read size rejection, source-revision mismatch, unsupported script mutation, normalized imported artifacts, immutable branch persistence and no hidden active-leaf mutation.

Accepted repository checkpoint:

```text
08bd0b69c961baa08fc2f95072b125366a61d0e5
Test Phase 8G import lifecycle boundary
```

Exact-head evidence:

- Quality Gate #529 / run `34055006299` — PASS;
- Grasshopper Build #105 / run `34055006300` — PASS;
- tests/typecheck/lint/build/diff-check — PASS;
- Rhino/Grasshopper SDK plugin build — PASS;
- package build on Ubuntu — PASS;
- package build on Windows — PASS.

### 8H — Brepia browser/product round-trip — accepted

The complete Brepia-side strict-v1 loop was accepted in the real authenticated local browser/runtime on 2026-09-07. Full evidence and the post-acceptance main-page routing note live in `docs/brep_phase8h_browser_acceptance.md`.

Accepted loop:

```text
prompt
 -> Native BRep
 -> Brepia native 3D
 -> GHX export
 -> Width 1200 -> 1500
 -> GHX import
 -> new immutable revision remains inactive
 -> explicit activation
 -> Width 1500
 -> native 3D again
```

The browser exercise also exposed and corrected sign-in selector drift and the database `update_leaf_trigger` interaction that had auto-activated imported revisions. The final import lifecycle restores the previous active leaf with compare-and-swap semantics only while the trigger still points to the imported revision.

Repository gates on the 8H product-fix checkpoint `26b303ffad38f5aee062dda11173044831308466`:

- Quality Gate #546 / run `34136092218` — PASS;
- Grasshopper Build #119 / run `34136092167` — PASS.

Subsequent post-Phase 8 UX work is tracked in `docs/post_phase8_product_ux_and_generation_status_plan.md`; it does not weaken or replace the accepted GHX round-trip evidence.

## Deferred real-runtime acceptance

Installed Rhino/Grasshopper acceptance is deliberately separated into **Phase 9**: `docs/brep_phase9_rhino_acceptance.md`.

Phase 8 is not blocked by that workstation dependency. Phase 9 will verify zero-install GHX open/solve, parameter edits, save/reopen, supported Brepia re-import, canonical continuation and regenerated GHX when Rhino 8 is available.

## GHX validation and AI repair policy

The minimum validator stack is:

```text
bounded bytes / UTF-8 / safe XML
        -> GHX structural checks
        -> Brepia semantic identity + parameter checks
        -> round-trip compatibility classification
        -> optional real Rhino/GH runtime acceptance
```

AI sits around, not instead of, this stack:

```text
validator diagnostics -> AI interpretation/repair -> deterministic re-validation
```

Never persist an AI-repaired generated artifact or returned GHX as canonical state until the deterministic gate passes.

For issues visible only after export, the intended support path is simple: inspect in Grasshopper, then use the returned GHX plus user description/screenshots as AI troubleshooting context. Brepia does not need to duplicate Grasshopper's visual environment.

## External logic boundary

Brepia should stay focused on the supported products/model families and the canonical AI -> model -> preview -> GHX -> supported return loop.

General Grasshopper automation does not need to move into Brepia. It can remain in tools such as:

- ordinary Grasshopper graphs;
- Rhino/Grasshopper Python or C# scripts;
- ChatGPT-assisted scripting and interpretation;
- MCP-controlled Rhino/Grasshopper workflows;
- specialist plug-ins outside Brepia's supported round-trip contract.

This is intentional scope control, not a missing feature.

## Phase 7 relationship

The Phase 7 `.gha` smart component remains useful reference implementation and an optional fallback experiment. Installed-Rhino acceptance of that GHA path is no longer a prerequisite for the GHX-native baseline.

Do not delete or rewrite the existing Phase 7/8 implementation history merely because the product direction changed. Future work should reuse validated identity, transport, geometry and reconciliation concepts where they fit the GHX-native architecture.

## Validation and evidence classes

Normal repository changes retain:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Keep evidence classes explicit:

- portable compiler/parser/validator tests;
- deterministic GHX fixture tests;
- Rhino/Grasshopper SDK compile evidence where SDK code remains relevant;
- installed Rhino/Grasshopper runtime evidence — Phase 9 only.

Do not promote evidence from one class into another.
