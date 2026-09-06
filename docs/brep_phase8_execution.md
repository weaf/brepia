# BRep Phase 8 — Grasshopper package and round-trip workflow

## Status

Phase 8 is active on the stacked branch:

```text
feature/brep-grasshopper-gh-packaging
```

Its base is the Phase 7 branch `feature/brep-grasshopper-smart-component`. Phase 7A–7C are repository-complete; Phase 7D installed Rhino/Grasshopper runtime acceptance remains deferred until a real Rhino 8 runtime is conveniently available.

Phase 8A is repository-complete. Phase 8B — plan-driven Grasshopper object emission — is the next implementation slice. Installed Rhino/Grasshopper runtime acceptance remains deferred and is not implied by Phase 8A completion.

## Product boundary

Brepia remains the canonical AI-first parametric CAD system. The generated Grasshopper artifact is an interoperability/workflow package around the Brepia-owned smart component, not a translation of the full Brepia feature DAG into native Grasshopper nodes and not a second canonical authoring model.

Target loop:

```text
Brepia AI + canonical BrepProject
        |
        v
stable Grasshopper package plan
        |
        v
Brepia Project component + ordinary GH controls/workflow
        |
        v
Rhino / Grasshopper continuation
        |
        v
identity-aware import/reconciliation back to Brepia
```

External Grasshopper additions remain external until a deliberate mapping/reconciliation rule exists. Phase 8 does not claim lossless arbitrary GH graph -> `BrepProject` conversion.

## Runtime discovery

Phase 8A explicitly tested the boundary between the Rhino/Grasshopper SDK packages and a standalone .NET host.

Observed on ordinary GitHub-hosted Ubuntu and Windows runners:

- the Phase 7 `.gha` continues to compile against the pinned Rhino 8 SDK;
- the Phase 8 packager code referencing RhinoCommon/Grasshopper also compiles without an installed Rhino desktop;
- executing the full Grasshopper/Rhino-dependent packager from a normal `dotnet` process fails before document emission because the Rhino/Grasshopper assemblies expect a Rhino-owned runtime host;
- `GH_Archive.WriteToFile()` is not a portable Linux boundary because it loads `System.Windows.Forms`;
- lower-level `GH_Archive.Serialize_Binary()` still loads `System.Drawing.Common` on stock Ubuntu;
- `GH_Archive.Serialize_Xml()` also loads `System.Drawing.Common` on stock Ubuntu.

Concrete diagnostic evidence:

- Grasshopper Build run `34034673461`: full standalone packager execution failed on both Ubuntu and Windows with CoreCLR host initialization failure while compile succeeded;
- Grasshopper Build run `34035092145`, Ubuntu job `101491581375`: standalone binary GH_IO serialization failed on missing `System.Drawing.Common`;
- Grasshopper Build run `34035373743`, Ubuntu job `101492342721`: standalone XML GH_IO serialization failed on the same `System.Drawing.Common` dependency.

The GH_IO probe was therefore removed from permanent CI. These experiments characterize the unsupported host boundary; Brepia will not accumulate compatibility shims, fake a Rhino host or reverse-engineer private Grasshopper binary serialization merely to bypass it.

The supported free development boundary is instead:

```text
Linux / ordinary CI
  - canonical Brepia contract tests
  - deterministic package-plan tests
  - normal Brepia quality gate
  - Rhino/Grasshopper SDK compilation

Installed Rhino / supported Rhino-owned host later
  - instantiate real GH objects
  - serialize/open complete .gh
  - solve component
  - import exact native Rhino Breps
  - interactive canvas/save/reopen acceptance
```

## Phase 8A — portable deterministic package plan

The portable source of truth for generated Grasshopper packaging is `shared/brepGrasshopperPackagePlan.ts`.

The plan is derived only from a normalized Phase 6 `brepia-grasshopper-contract` and contains:

- `kind = brepia-grasshopper-package-plan`;
- schema version 1;
- canonical project identity plus immutable source-revision provenance;
- the normalized contract that the smart component must embed;
- one deterministic Brepia Project component identity;
- one deterministic control identity per published numeric parameter;
- explicit control -> stable Brepia input-ID wiring;
- deterministic canvas positions;
- conservative control presentation:
  - use a slider only when the canonical parameter supplies both finite `min` and `max` with `min < max`;
  - otherwise use a normal number control rather than inventing an arbitrary slider range;
- no generated source for `placement`; the standard Plane input remains unconnected so Phase 7 resolves canonical project placement until a Grasshopper user deliberately connects a Plane.

Generated Grasshopper object IDs are deterministic RFC 9562 UUIDv8 values. Their semantic key deliberately excludes `sourceRevisionId`:

- project component identity derives from stable Brepia `projectId` + object role;
- numeric control identity derives from stable Brepia `projectId` + parameter ID + object role;
- `sourceRevisionId` remains immutable provenance inside the embedded contract/model identity;
- a new revision of the same Brepia project therefore preserves generated component/control identity and can be reconciled with existing project-level Grasshopper wiring;
- a different Brepia project identity receives different generated Grasshopper object IDs.

The UUID input segments are length-prefixed before SHA-256 hashing, then encoded as RFC-variant UUIDv8 values. This avoids delimiter ambiguity while remaining deterministic across the TypeScript package plan and C# emitter boundary.

The package plan contains no evaluator URL, bearer token or other secret/runtime configuration.

## Rhino-hosted emission adapter

`grasshopper/Brepia.Grasshopper/Packaging/BrepiaGrasshopperDocumentPackager.cs` is the Rhino/Grasshopper-side emitter boundary. It uses official `GH_Document` / `GH_Archive` APIs and the existing `BrepiaProjectComponent` persistence path rather than hand-authoring Grasshopper's private document schema.

The adapter currently:

- parses the trusted v1 contract;
- instantiates one `BrepiaProjectComponent`;
- embeds the normalized contract through the existing component persistence path;
- applies the same revision-stable project-derived UUIDv8 component identity as the portable package model;
- constructs a `GH_Document` / `Definition` archive;
- contains no evaluator/solve call;
- compiles against the exact pinned Rhino 8 SDK pair on ordinary CI.

Actual execution that creates a complete `.gh` containing real Grasshopper objects remains installed-Rhino/runtime evidence. The adapter's numeric-control and wire emission is the next implementation slice and must follow the portable package plan rather than inventing a second model.

Do not reverse-engineer a complete `.gh` binary graph merely to avoid the runtime boundary. The portable plan is deliberately separated from the runtime adapter so most product behavior can be designed, diffed and tested without Rhino while final emission remains faithful to Grasshopper's own object model.

## Phase slices

### 8A — deterministic package model and host boundary — repository complete

Accepted repository behavior:

- canonical contract -> deterministic package plan;
- stable project/control identity across ordinary Brepia revisions while retaining exact source-revision provenance;
- deterministic control layout and wiring by stable parameter ID;
- no fabricated parameter semantics;
- placement left unconnected by default;
- no secrets in package state;
- Rhino/GH emitter code compiles against the exact pinned SDK pair on Ubuntu and Windows;
- unsupported standalone Rhino/GH and GH_IO runtime boundaries are explicitly characterized and excluded from the permanent gate.

Repository acceptance checkpoint:

```text
a033df76f054bf77c467118c8029a6a3eefe8f7e
Reconcile Phase 8A runtime and identity findings
```

On that exact implementation/documentation checkpoint:

- Quality Gate #468 / run `34035477350` — PASS;
- tests — PASS;
- typecheck — PASS;
- lint — PASS;
- build — PASS;
- diff check — PASS;
- Grasshopper Build #44 / run `34035477375` — PASS;
- Phase 7 `.gha` restore/build/artifact job — PASS;
- Phase 8 package build on `ubuntu-latest` — PASS;
- Phase 8 package build on `windows-latest` — PASS.

This slice does **not** claim that a generated `.gh` has opened or solved in Grasshopper.

### 8B — plan-driven Grasshopper object emission — next

Implement the Rhino-hosted adapter from the portable plan:

- instantiate one `Brepia Project` component;
- embed the normalized contract;
- apply stable component identity;
- instantiate supported numeric controls;
- apply defaults/ranges/steps without widening canonical constraints;
- connect controls to dynamic inputs by stable Brepia parameter ID, never label matching;
- preserve the Plane input as intentionally unconnected by default;
- serialize through Grasshopper's own document/archive APIs under a supported Rhino-owned runtime.

Repository acceptance is compile/static/contract coverage; installed Rhino acceptance remains deferred.

### 8C — Brepia export/package integration

Expose the Phase 8 packaging flow through the existing BRep export surface without changing `BrepProject` authority. Normal Brepia authoring, preview and native BRep export must remain independent of Rhino.

Any final `.gh` emission that requires a Rhino-owned runtime must remain an explicit optional interoperability boundary rather than becoming a hidden dependency of ordinary Brepia operation.

### 8D — round-trip identity and reconciliation envelope

Define what Brepia can reliably recover when a generated Grasshopper workflow returns:

- Brepia project and source revision identity;
- embedded canonical Brepia contract/component state;
- stable parameter IDs and current Brepia-owned input values where recoverable;
- external downstream GH objects/connections as external graph evidence rather than silently converting them into canonical Brepia features.

The first round trip is identity-aware reconciliation, not generic GH-to-BrepProject translation.

### 8E — installed Rhino/Grasshopper end-to-end acceptance

When Rhino 8 is available, verify the representative cabinet workflow end-to-end:

1. emit/open the generated `.gh`;
2. verify the Brepia Project component loads from the installed `.gha`;
3. verify generated controls, defaults and stable wiring;
4. vary at least two parameters and receive changing native Rhino Breps;
5. verify unconnected and connected Plane placement semantics without scale;
6. verify auxiliary exact/semantic outputs and metadata identity;
7. save/reopen the `.gh` and preserve Brepia identity/wiring;
8. add ordinary Grasshopper downstream content and confirm Brepia-owned identity remains recognizable;
9. exercise the first identity-aware import/reconciliation path back into Brepia.

Installed Rhino evidence is required before the roadmap can claim real `.gh` interoperability complete.

## Validation and evidence classes

Portable/repository work keeps the normal Brepia gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Grasshopper-side code additionally requires the pinned Rhino 8 SDK build gate. Runtime statements are classified explicitly as one of:

- portable contract/package-plan evidence;
- Rhino/Grasshopper SDK compile evidence;
- negative standalone-host capability evidence;
- installed Rhino/Grasshopper runtime evidence.

Do not promote evidence from one class into another.
