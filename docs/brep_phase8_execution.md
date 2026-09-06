# BRep Phase 8 — GHX-native Grasshopper interoperability

## Status

Phase 8 is active on:

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

Repository-level 8E is complete. The next active implementation slice is 8F. Installed Rhino/Grasshopper runtime acceptance remains explicitly deferred to 8H.

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

The concepts remain useful, but the final import path must be generalized from the custom `BrepiaProjectComponent` assumption to the GHX-native identity/compatibility contract described in `docs/grasshopper_roundtrip_architecture.md`.

## Characterized runtime boundary

Earlier probes established that compile success against Rhino/Grasshopper SDK packages does not imply a supported standalone Grasshopper runtime. Full standalone package execution and GH_IO serialization paths pulled Rhino/desktop/runtime dependencies in ordinary CI.

Those negative probes remain useful evidence, but GHX-native generation changes their product significance: Brepia should not require a Rhino-owned runtime merely to create its primary Grasshopper document artifact.

Do not add fake Rhino hosts, private binary `.gh` reverse engineering or compatibility shim chains merely to force standalone `.gh` generation.

## Revised active Phase 8 slices

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
- real open/solve/parameter-change/save/reopen acceptance remains 8H and must not be inferred from repository CI.

No embedded GHX viewer is required. The user can inspect exported files in Grasshopper. If something is wrong, they can return the GHX, describe the problem or provide screenshots for AI-assisted diagnosis.

### 8F — Brepia AI/product integration and preview parity — next

Integrate the now-validated GHX generation boundary into the normal Brepia model lifecycle while preserving the existing native BRep preview/evaluation path.

Representative acceptance scenario:

1. user asks Brepia to create a composite/plastic electrical cabinet, 2000 x 600 x 600 mm, 3 mm wall, three DIN-rail rows;
2. Brepia creates the canonical model and shows the 3D preview without Rhino;
3. user asks for a larger handle and a window in the door;
4. Brepia updates and previews the model;
5. export generates a valid editable GHX representation of that same Brepia-owned model when the canonical model belongs to the currently supported GHX subset;
6. unsupported canonical geometry fails explicitly instead of silently producing an approximate Grasshopper model.

AI should normally author a structured model/graph representation consumed by the compiler rather than freehand large GHX XML blobs.

The first product-facing integration should keep Brepia preview authoritative and expose deterministic GHX capability/diagnostics. It should not add a Grasshopper viewer or claim support for canonical node types that 8E has not yet proven.

### 8G — strict v1 GHX round-trip

Implement the first deliberately narrow import contract in the product lifecycle.

Supported v1 behavior:

- recognize Brepia project and provenance;
- recognize expected Brepia-owned generated structure/code/template identity;
- recover explicitly supported published parameter values;
- validate values against canonical constraints;
- allow harmless presentation/layout differences only where proven non-semantic;
- update canonical Brepia state only after deterministic compatibility validation passes;
- continue normal Brepia AI editing and preview after successful import.

Unsupported v1 behavior:

- arbitrary native GH nodes that alter model semantics;
- unknown rewiring of Brepia-owned inputs;
- unrecognized edits to embedded bridge/script logic;
- arbitrary plugin components;
- generic GH graph -> canonical `BrepProject` reconstruction.

If unsupported content is detected, retain the last valid canonical Brepia revision and tell the user that the returned Grasshopper model cannot currently be reused with guaranteed results.

AI may interpret the unsupported graph, explain likely changes and help recreate them in Brepia, but such interpretation remains advisory until a deterministic supported-import rule exists.

### 8H — installed Rhino/Grasshopper end-to-end acceptance

When Rhino 8 is available, verify the zero-install baseline end-to-end with no Brepia GHA installed:

1. open Brepia-generated `.ghx` in Grasshopper;
2. verify standard controls and embedded Script/C# Script load correctly;
3. verify expected native Rhino geometry/output behavior;
4. change at least two published parameters;
5. save/reopen and preserve Brepia identity and supported state;
6. re-import the parameter-modified GHX into Brepia;
7. verify deterministic compatibility classification and recovered parameter values;
8. continue editing the model with Brepia AI and native Brepia preview;
9. regenerate a fresh GHX and reopen it successfully.

Only after this evidence may the roadmap claim the zero-install GHX round trip operational in real Rhino/Grasshopper.

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
- installed Rhino/Grasshopper runtime evidence — required for final real-runtime acceptance.

Do not promote evidence from one class into another.
