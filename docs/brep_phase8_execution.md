# BRep Phase 8 — Grasshopper package and round-trip workflow

## Status

Phase 8 is active on the stacked branch:

```text
feature/brep-grasshopper-gh-packaging
```

Its base is the Phase 7 branch `feature/brep-grasshopper-smart-component`. Phase 7A–7C are repository-complete; Phase 7D installed Rhino/Grasshopper runtime acceptance remains deferred until a real Rhino 8 runtime is conveniently available.

Phase 8 must therefore maximize deterministic Linux/CI-verifiable work without treating SDK compilation or archive serialization as proof of a real Grasshopper solve.

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
- the Phase 8 packager code referencing RhinoCommon/Grasshopper also compiles on both platforms;
- executing the full Grasshopper/Rhino-dependent packager from a normal `dotnet` process fails before a document can be emitted, because the Rhino/Grasshopper assemblies expect a Rhino-owned runtime host;
- a standalone `GH_IO` probe can be compiled independently of RhinoCommon/Grasshopper kernel types;
- `GH_Archive.WriteToFile()` itself pulls in `System.Windows.Forms`, so that convenience method is not a portable headless file-I/O boundary;
- the lower-level `GH_Archive.Serialize_Binary()` / `Deserialize_Binary()` codec is being used as the portable archive probe instead of desktop file-dialog/file-I/O helpers.

These findings are an architectural constraint, not a reason to emulate or bypass Rhino licensing/runtime initialization. Brepia will not invent an unsupported fake Rhino host.

## Phase 8A — portable deterministic package plan

The portable source of truth for generated Grasshopper packaging is `shared/brepGrasshopperPackagePlan.ts`.

The plan is derived only from a normalized Phase 6 `brepia-grasshopper-contract` and contains:

- `kind = brepia-grasshopper-package-plan`;
- schema version 1;
- canonical project/revision identity;
- the normalized contract that the smart component must embed;
- one deterministic Brepia Project component identity;
- one deterministic control identity per published numeric parameter;
- explicit control -> stable Brepia input-ID wiring;
- deterministic canvas positions;
- conservative control presentation:
  - use a slider only when the canonical parameter supplies both finite `min` and `max` with `min < max`;
  - otherwise use a normal number control rather than inventing an arbitrary slider range;
- no generated source for `placement`; the standard Plane input remains unconnected so Phase 7 resolves canonical project placement until a Grasshopper user deliberately connects a Plane.

Generated object IDs are deterministic RFC 9562 UUIDv8 values derived from the immutable Brepia project/revision identity plus object role/input ID. A new Brepia source revision therefore receives a new generated workflow-object identity while stable Brepia parameter IDs remain the semantic wiring anchors.

The package plan contains no evaluator URL, bearer token or other secret/runtime configuration.

## Rhino-hosted emission adapter

`grasshopper/Brepia.Grasshopper/Packaging/BrepiaGrasshopperDocumentPackager.cs` is the eventual Rhino/Grasshopper-side emitter boundary. It uses official `GH_Document` / `GH_Archive` APIs and the existing `BrepiaProjectComponent` persistence path rather than hand-authoring Grasshopper's private document schema.

The adapter can be compiled in CI. Actual execution that creates a complete `.gh` containing real Grasshopper objects remains installed-Rhino runtime evidence unless a supported Rhino-owned headless host becomes available.

Do not reverse-engineer a complete `.gh` binary graph merely to avoid this runtime boundary. The portable plan is deliberately separated from the runtime adapter so most product behavior can be designed, diffed and tested without Rhino while final emission remains faithful to Grasshopper's own object model.

## Planned slices

### 8A — deterministic package model and host boundary — active

Acceptance without Rhino Desktop:

- canonical contract -> deterministic package plan;
- stable project/revision/control identity;
- deterministic control layout and wiring by stable parameter ID;
- no fabricated parameter semantics;
- placement left unconnected by default;
- no secrets in package state;
- Rhino/GH emitter code compiles against the exact pinned SDK pair;
- standalone GH_IO binary-codec capability is explicitly characterized on Linux and Windows CI.

This slice does **not** claim that a generated `.gh` has opened or solved in Grasshopper.

### 8B — plan-driven Grasshopper object emission

Implement the Rhino-hosted adapter from the portable plan:

- instantiate one `Brepia Project` component;
- embed the normalized contract;
- apply stable component identity;
- instantiate supported numeric controls;
- apply defaults/ranges/steps without widening canonical constraints;
- connect controls to dynamic inputs by stable Brepia parameter ID, never label matching;
- preserve the Plane input as intentionally unconnected by default;
- serialize through Grasshopper's own document/archive APIs.

Repository acceptance is compile/static/contract coverage; installed Rhino acceptance remains deferred.

### 8C — Brepia export/package integration

Expose the Phase 8 packaging flow through the existing BRep export surface without changing `BrepProject` authority. The web/server layer should produce the deterministic plan and hand final `.gh` emission to a supported runtime boundary when available. It must not require Rhino for normal Brepia authoring, preview or native BRep export.

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

## Validation

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
- SDK compile evidence;
- GH_IO archive-codec evidence;
- installed Rhino/Grasshopper runtime evidence.

Do not promote evidence from one class into another.
