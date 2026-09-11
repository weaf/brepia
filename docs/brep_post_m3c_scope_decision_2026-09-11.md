# Post-M3C modeling scope decision — 2026-09-11

Status: **DECIDED — M3C is complete. Do not automatically start M5 shell/thickness, M7 finishing/topology, or C4 image projection. Reconcile the next product-driven modeling gap before selecting another slice.**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Accepted basis

M3C bounded rectangular pattern is complete across all required boundaries:

- canonical/shared contract;
- finite provider/AI authoring contract;
- structural editor;
- multi-body viewer and export path;
- repository CI;
- real pinned build123d / OCCT native runtime;
- installed Rhino 8 / Grasshopper;
- parameter perturbation;
- save -> close -> reopen persistence;
- strict parameter-only returned-GHX validation.

Evidence:

```text
docs/brep_m3c_rectangular_pattern_status.md
docs/brep_m3c_native_runtime_evidence_2026-09-11.md
docs/brep_m3c_rhino8_runtime_evidence_2026-09-11.md
```

The accepted modeling-language set is therefore M0, M1, M2, M3A, M3B, M3C, M4 and M6.

## What M3C closed

Before M3C, canonical v1 could express one-dimensional bounded repetition through M3B but could not represent a true two-dimensional parameterized grid without manually expanding transform nodes or broadening into forbidden nested collection algebra.

M3C closes that gap with one bounded operation:

```text
single -> rectangularPattern(axisA, axisB, countA, countB, spacingA, spacingB)
       -> ordered instanceSet
```

The accepted contract retains:

- two distinct canonical axes;
- literal counts 2–32;
- total instance cap 64;
- M1 scalar/expression spacing;
- non-zero effective spacings;
- A-outer/B-inner row-major order;
- flat identity `index = a * countB + b`;
- stable `<patternId>::<index>` body IDs;
- final Result List Access for the `instanceSet`;
- ordered consumption only through `subtract.tools[]`;
- no implicit union;
- no nested/general collection algebra.

## Remaining roadmap candidates

The previously identified future candidates remain:

### M5 — shell/thickness

Still deferred. The accepted M1/M2/M4/M6 surface can already model ordinary plates, walls, hollows and openings through explicit profiles/extrusions, derived dimensions and Booleans. A shell/thickness primitive should not be added merely to reduce graph verbosity.

Reconsider M5 only when a concrete target model demonstrates a material representational gap and the native/Rhino offset/shell semantics can be bounded without persisting kernel-specific face identity.

### M7 — finishing/topology

Still deferred. Chamfer and broader fillet/edge/face selection require a topology-stability design. Do not persist raw Rhino/build123d/OCCT topology indices as canonical authority.

Reconsider M7 only with a semantic selector contract and deterministic native/Rhino parity fixtures.

### C4 — image projection

Still deferred. M3C does not change the previous context-budget/image-projection decision.

## Why no automatic next modeling slice is selected

M3C was selected because it closed a demonstrated topology-neutral representational gap. With M3C accepted, the remaining named candidates are either topology-sensitive or have not yet been justified by a concrete model that the current language cannot represent cleanly enough.

The next modeling expansion should therefore begin with reconciliation against real target models and product behavior, not by consuming roadmap items in numerical order.

A future scope decision should answer:

1. What concrete target model cannot be represented adequately by M0–M4 + M6 + M3C?
2. Is the limitation representational, or only graph verbosity/editor ergonomics?
3. Can the proposed operation remain kernel-neutral and additive to canonical `schemaVersion: 1`?
4. Can build123d/OCCT and Rhino 8 implement the same bounded semantics?
5. Can the operation preserve M0 effectiveness, M1 scalar bounds, M2 cardinality rules and M3 `single | instanceSet` discipline?
6. Can the GHX return boundary remain parameter-only?

Until such a target is selected, M5, M7 and C4 remain deferred rather than active work.

## Preserved architecture

The post-M3C boundary preserves:

- `conversation.type = 'parametric'`;
- explicit Native BRep routing through `parametricSourceKind = 'brep'`;
- canonical BRep project plus immutable revision authority;
- build123d / OCCT geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter effectiveness;
- M1 scalar depth 12 / node limit 64;
- provider expression depth 2 and finite/reference-free provider schema;
- M2 exact-one-body Boolean semantics;
- M3B/M3C `single | instanceSet` result discipline and narrow subtract-tool collection consumption;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ `R = Rx * Ry * Rz`, `p' = R*p + T`;
- GHX parameter-only return/import semantics;
- Result Item/List semantics;
- OpenSCAD regressions.

## Next action

Stop modeling-language expansion at the M3C closeout boundary. In the next planning session, reconcile the accepted capability set against concrete product fixtures and select a new slice only if a demonstrated gap justifies it.
