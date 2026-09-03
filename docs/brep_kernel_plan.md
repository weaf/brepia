# Brepia BRep kernel foundation plan

## Status

Approved roadmap. Phase 1 and Phase 2 are complete and merged. Phase 3 — AI-native BRep editing — is active.

Current Phase 3 base checkpoint:

```text
6e0ec92a439fb7e936a5d02001742df38a4c38d7
Merge pull request #20 from weaf/feature/brep-project-lifecycle
Phase 2: native BRep project lifecycle
```

Current Phase 3 branch:

```text
feature/brep-ai-native-editing
```

The active Phase 3 execution contract is `docs/brep_phase3_execution.md`; current progress is tracked in `docs/brep_phase3_status.md`.

This roadmap is architectural direction. Completed phase execution/status documents are historical evidence once their phase is merged. Current implementation remains the source of truth.

## Final product goal for this plan

```text
Brepia Parametric Model
        |
        v
smart parametric Grasshopper object / .gh workflow
        |
        v
Rhino / Grasshopper project model
```

A completed roadmap must allow a Brepia-authored parametric component to be consumed in Grasshopper as a smart parametric object rather than merely as frozen STEP/3DM/BRep geometry.

## Strategic architecture

Brepia owns a constrained, versioned, kernel-neutral parametric model. Exact BRep evaluation remains server-side through the accepted rootless Podman build123d/OCCT sandbox. OpenSCAD remains first-class. Rhino/Grasshopper remain interoperability and project-composition targets rather than Brepia's mandatory geometry runtime.

```text
Brepia UI / AI
       |
       v
Brepia Parametric Model
feature graph / DAG / stable model schema
       |
       +--> OCCT/build123d backend      primary exact B-Rep path
       +--> OpenSCAD                    existing first-class mode
       +--> Grasshopper exporter        roadmap destination
       +--> Rhino.Compute provider      optional later path
       |
       v
common geometry/result contract
       |
       +--> browser Three.js viewer
       +--> STEP
       +--> STL / mesh outputs
       +--> 3DM interoperability
```

## Core architectural principles

1. **Brepia owns the persisted parametric contract.** Persist canonical `BrepProject` snapshots, not build123d/OCCT/Rhino runtime objects.
2. **Published parameters are first-class.** Stable parameter IDs are revision/diff anchors and future Grasshopper inputs.
3. **Stable feature identity.** Preserve node IDs through ordinary edits; allocate new IDs only for genuinely new features.
4. **Explicit validated DAG.** Dependencies remain bounded, acyclic and deterministic.
5. **No arbitrary Python.** Normal BRep projects compile from the constrained Brepia model inside the hardened native runtime.
6. **Preserve native-execution isolation.** Rootless container, network disabled, read-only root, no-new-privileges, dropped capabilities and bounded resources remain mandatory.
7. **Browser viewer is presentation, not authoritative geometry.**
8. **Grasshopper integration is an export contract, not a second source of truth.**
9. **AI edits complete canonical snapshots.** AI must not edit STEP, viewer meshes, OCCT objects, build123d/Python code or raw topology indices.
10. **Conversation history is the revision model.** AI edits reuse the Phase 2 immutable message tree/current-leaf lifecycle; no parallel AI history is introduced.

## Canonical source and lifecycle

The shared parametric source discriminator is:

```text
ParametricProjectSource
  kind: openscad | brep
  source: normalized OpenScadProject | normalized BrepProject
```

For native BRep, the active editable authority is the normalized `BrepProject` snapshot stored in a `data-brep-project` artifact on the ordinary immutable conversation message tree.

```text
conversation
    -> immutable source revision
    -> immutable source revision
    -> current_message_leaf_id selects active leaf
    -> restore / branch / retry semantics reuse the same tree
```

Derived tessellation, exact STEP and evaluator diagnostics are never source authority.

## Topology and selection

Topology persistence remains a major risk. Raw OCCT indices must never become public stable identities.

Prefer combinations of semantic selectors, geometric signatures, feature provenance, persistent naming strategies and deterministic ambiguity/failure reporting. Never silently retarget a selector when topology becomes ambiguous.

Phase 3 AI instructions must therefore constrain the model to the selector vocabulary actually supported by the canonical schema. If an edit cannot be expressed without unstable topology references, fail closed rather than inventing an index-based selector.

## Phase roadmap

### Phase 0 — Architecture closure — complete

Accepted direction: Brepia-owned versioned DAG, stable published parameters/features, authoritative server-side OCCT/build123d sandbox, no arbitrary Python, OpenSCAD first-class, Grasshopper smart-object destination.

### Phase 1 — Minimal vertical BRep foundation — complete

Merged through PR #19. Established the canonical `BrepProject` schema, normalization/validation, provider/result contract, isolated OCCT/build123d runtime, tessellated viewer payload and direct exact STEP export.

### Phase 2 — Native BRep project lifecycle — complete

Merged through PR #20 at `6e0ec92a439fb7e936a5d02001742df38a4c38d7`.

Established first-class native BRep project creation/opening, discriminated persisted source, immutable revisions, parameter editing, restore/branch semantics, canonical `brepia-brep-project` import/export and normal product routing without regressing OpenSCAD.

### Phase 3 — AI-native BRep editing — active

Goal: AI creates/modifies complete structured BRep snapshots, preserving stable IDs where reasonable and producing meaningful structural/parameter diffs.

The authoritative Phase 3 sequence is defined in `docs/brep_phase3_execution.md`.

Required outcome:

- create a new complete canonical `BrepProject` from a user request;
- follow up on an existing BRep project using the immediately preceding canonical snapshot;
- edit published parameter definitions and defaults;
- add/remove/modify feature-DAG nodes;
- preserve project ID and unchanged node/parameter IDs;
- allocate IDs only for genuinely new objects;
- validate/normalize before persistence or native execution;
- persist successful AI results as ordinary immutable source revisions;
- reject malformed, stale or semantically unsafe AI results without moving the active leaf;
- expose a deterministic structural diff/summary between previous and next snapshots;
- retain existing OpenSCAD `build_parametric_model` behavior and external-agent continuity.

### Phase 4 — Brepia graph/editor UX

Expose direct feature/node editing over the same canonical model. The graph is an editor/view, not another runtime.

### Phase 5 — Project-object contract and Rhino interoperability

Define primary BRep, insertion/local coordinate system, footprint, clearance/maintenance envelopes, connection points and typed metadata/classification. Add minimum 3DM/rhino3dm support required by the Grasshopper path.

### Phase 6 — Grasshopper export contract

Map published Brepia parameters and project-object outputs to a stable Grasshopper-facing schema, including placement `Plane`, units/defaults, IDs, diagnostics and output metadata.

### Phase 7 — Smart Brepia Grasshopper component

Provide the reusable Grasshopper-side component/runtime needed to consume a Brepia model as a smart parametric object.

### Phase 8 — `.gh` export/package and end-to-end railway workflow — roadmap completion

Brepia exports a consumable Grasshopper artifact/workflow. The acceptance scenario remains: author a reusable Brepia object, publish parameters, export to Grasshopper, place it from alignment/chainage-derived planes, vary parameters, receive Rhino BRep plus project outputs, and re-export revised Brepia objects without redesigning project-level placement logic.

## Explicit non-goals for Phase 3

- Phase 4 graph/editor UX;
- Phase 5 Rhino/3DM project-object work;
- Phase 6 Grasshopper export schema;
- Phase 7 GH component runtime;
- Phase 8 `.gh` workflow packaging;
- browser-authoritative OCCT;
- arbitrary Python/build123d source editing;
- STEP-to-parametric reconstruction;
- raw topology-index identities;
- weakening the accepted Phase 1/2 native sandbox;
- replacing the OpenSCAD AI/project workflow.

## Current next action

Execute Phase 3A from `docs/brep_phase3_execution.md`: reconcile the existing AI/tool/external-agent/message lifecycle against native BRep source artifacts, lock the AI snapshot/diff contract, and add the separable shared validation/diff primitives before transport/runtime integration.