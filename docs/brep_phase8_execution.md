# BRep Phase 8 — GHX-native Grasshopper interoperability

## Status

Phase 8 is repository-complete on:

```text
feature/brep-grasshopper-gh-packaging
```

The detailed current product authority is `docs/grasshopper_roundtrip_architecture.md`. This execution document records completed implementation evidence and the revised Phase 8 slices that follow that architecture.

A design pivot was agreed on 2026-09-06 after reviewing GHX/GH format behavior, Rhino 8 embedded Script components and related open tooling:

- GHX is the primary Grasshopper document interchange target;
- the user must see and revise the Brepia-generated 3D model in Brepia before Grasshopper is opened;
- the canonical Brepia/BRep model remains authoritative for Brepia-owned geometry and revisions;
- the preferred baseline is zero-install GHX using standard Grasshopper/Rhino 8 facilities, with embedded Script/C# Script where executable bridge logic is needed;
- a Brepia `.gha` is optional/reference/fallback rather than a baseline product requirement;
- initial GHX re-import is deliberately strict: recover supported Brepia parameter changes and provenance, but reject unsafe/unknown graph mutations rather than guessing;
- AI remains central to generation, interpretation and repair, but deterministic parsing/validation gates every accepted GHX artifact and every canonical round-trip update;
- Brepia is not a general Grasshopper automation product: broader scripting/logic may remain in Grasshopper, ChatGPT, Python or MCP-based workflows.

Repository-level Phase 8 is complete through 8G. Installed Rhino/Grasshopper runtime acceptance is no longer a blocking Phase 8 sub-step; it is tracked separately in `docs/brep_phase9_rhino_acceptance.md` and begins when a real Rhino 8 workstation is available.

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

Evidence:

- Quality Gate #468 / run `34035477350` — PASS;
- Grasshopper Build #44 / run `34035477375` — PASS.

The portable package plan is reusable as an intermediate representation for the GHX compiler.

### 8B — Rhino-hosted native GH object emission prototype — repository complete

Implemented plan-driven instantiation of native Grasshopper controls, stable identities and wires through the pinned Grasshopper SDK. This proved the intended object semantics and parameter-ID wiring.

Accepted checkpoint:

```text
944f3b236ec16f54564d4feb045a3c3345208b3d
```

Evidence:

- Quality Gate #472 / run `34036162049` — PASS;
- Grasshopper Build #48 / run `34036162012` — PASS;
- package compilation — PASS on Ubuntu and Windows.

This code is now reference/fallback implementation evidence. The active product direction no longer requires a Rhino-owned runtime merely to emit the primary GHX interchange artifact.

### 8C — package-plan transport — repository complete

Implemented authenticated bounded transport for the deterministic package plan, normalization that rebuilds derived state from the embedded canonical contract, C# plan parsing and CLI support.

Accepted checkpoint:

```text
86ce44428f196ab616f9c38fe37ff5d22be00023
```

Evidence:

- Quality Gate #483 / run `34036826251` — PASS;
- Grasshopper Build #59 / run `34036826254` — PASS.

The transport and normalization boundaries remain reusable for GHX generation.

### 8D — reconciliation envelope and Grasshopper document scanner — repository complete as exploratory boundary

Implemented:

- portable `brepia-grasshopper-reconciliation` envelope;
- project/revision/component/control identity reconstruction from canonical contract;
- parameter recovery with canonical bounds validation;
- project-vs-Grasshopper placement classification;
- evidence-only external object/connection capture;
- fail-closed ambiguity handling;
- C# `GH_Document` scanner that does not solve geometry merely to inspect state.

Verified checkpoint immediately before the GHX-native roadmap pivot:

```text
fcc1e9ff589edc1a9570c4a6cddee79ef292ad7e
Cover Phase 8D Grasshopper reconciliation extractor boundary
```

Exact-head evidence:

- Quality Gate #488 / run `34037200446` — PASS;
- Grasshopper Build #64 / run `34037200447` — PASS;
- plugin build — PASS;
- package build on `windows-latest` — PASS;
- package build on `ubuntu-latest` — PASS.

The concepts remain useful, but the final import path was generalized from the custom `BrepiaProjectComponent` assumption to the GHX-native identity/compatibility contract described in `docs/grasshopper_roundtrip_architecture.md`.

## Characterized runtime boundary

Earlier probes established that compile success against Rhino/Grasshopper SDK packages does not imply a supported standalone Grasshopper runtime. Full standalone package execution and GH_IO serialization paths pulled Rhino/desktop/runtime dependencies in ordinary CI.

Those negative probes remain useful evidence, but GHX-native generation changes their product significance: Brepia does not require a Rhino-owned runtime merely to create its primary Grasshopper document artifact.

Do not add fake Rhino hosts, private binary `.gh` reverse engineering or compatibility shim chains merely to force standalone `.gh` generation.

## Completed Phase 8 slices

### 8E — GHX compiler + deterministic validator foundation — repository complete

The portable zero-install foundation is implemented without requiring an installed Rhino/Grasshopper runtime.

Implemented:

- `shared/brepGrasshopperGhx.ts`
  - deterministic GHX parameter-shell emission from the existing package plan;
  - real Grasshopper Number Slider / Number object identities;
  - bounded safe XML parsing and machine-readable diagnostics;
  - generated-mode canonical-default validation and returned-mode bounded parameter recovery.
- `shared/brepGrasshopperGhxArchive.ts`
  - reusable bounded GHX XML archive parser;
  - 4 MiB input limit, bounded nodes/depth/attributes/text;
  - rejects DTD, ENTITY, CDATA, processing instructions and malformed structure before semantic recovery.
- `shared/brepGrasshopperRhinoScript.ts`
  - deterministic Rhino 8 C# Script plan using McNeel/Rhino built-in component and RhinoCode identities;
  - self-contained RhinoCommon geometry code with no Brepia token, HTTP callback or GHA dependency;
  - stable component/input/output identity across Brepia revisions while `sourceRevisionId` remains provenance;
  - the current proven geometry subset is deliberately **exactly one canonical `box` node** whose result is the project result; optional semantic geometry roles may reuse that same result box;
  - other canonical node types (`cylinder`, `transform`, `subtract`, `fillet`) fail closed as unsupported until their RhinoCommon equivalence is separately proven.
- `shared/brepGrasshopperExecutableGhx.ts`
  - deterministic executable GHX candidate composed from native Number/Slider controls plus one embedded Rhino 8 C# Script component;
  - stable numeric input wiring;
  - unconnected placement input resolves canonical project placement;
  - eight Brepia output roles are preserved.
- `shared/brepGrasshopperExecutableGhxValidation.ts`
  - strict deterministic compatibility gate for the supported v1 executable subset;
  - accepts generated canonical state and parameter-only returned edits within canonical bounds;
  - normalizes GUID casing but freezes semantic identities;
  - validates control type/state, script component/library identity, port identity, converter assemblies/types, type hints, source wiring, runtime/marshalling flags, script source, language/version and object indexing;
  - unknown objects, rewiring, code mutation, runtime-setting mutation or unsupported graph changes fail closed and cannot become canonical Brepia state.

Reference format evidence was taken from public McNeel Rhino 8 GHX fixtures in `mcneel/rhinocodetests`; the production implementation remains Brepia-owned and does not depend on that repository at runtime.

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
