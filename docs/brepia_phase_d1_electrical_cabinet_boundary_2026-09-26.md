# Phase D1 — Electrical Cabinet product and acceptance boundary

Date: 2026-09-26  
Status: DESIGN BOUNDARY — implementation not yet started  
Baseline: `v1.6.0` / `ac13533abea937d9fac20a17836cb6d3f22816f7`

## Purpose

D1 is the first real built-in product template and the first end-to-end proof that C1–C5 form a coherent product platform.

This phase is limited to the Electrical Cabinet. It does not activate D2 Cable Tray, D3 Cable Conduit/Pipe or a speculative BRep capability phase.

## Reconciled baseline

Remote `master`, release `v1.6.0` and the release tag all resolve to:

`ac13533abea937d9fac20a17836cb6d3f22816f7`

The accepted template platform has:

- deterministic built-in template identity/versioning;
- parameter presentation metadata;
- discovery and preview;
- create-from-template into an independent project/revision lineage;
- fail-closed static and native template validation;
- canonical `BrepProject` source authority;
- build123d/OCCT exact native geometry authority;
- STEP exact export;
- Rhino/GHX as an interoperability boundary rather than geometry authority.

## Proven product seed

D1 must be based on the previously accepted canonical project:

- conversation: `64db3dec-ed0c-4575-a35f-26d205eec5ea`
- project id: `wallmounted-control-cabinet`
- result node: `cabinet`
- final accepted graph: 39 nodes
- the prior 35-node product identities were preserved when the door interaction was added;
- added door nodes: `door_closed`, `door_pivot_in`, `door_pivot_rot`, `door_pivot_out`;
- published door control: `doorOpenAngleDeg`, default `0`, minimum `0`, maximum `120`, unit `deg`;
- authoritative native evaluation succeeded at both 0° and 90°, with one body and no warnings.

The known product includes enclosure/body, door, hinges, handle/lock representation, internal mounting plate, three DIN rails, cable entry and ventilation features.

The old `phaseOneCabinetProject` sample is not the D1 geometry source.

### Source-recovery rule

The exact final canonical `BrepProject` snapshot must be recovered before a catalog entry is created.

Do not reconstruct the 39-node graph from documentation, memory, the earlier 17-parameter candidate or `phaseOneCabinetProject`. If the exact snapshot cannot be recovered, that is a D1 source-recovery blocker, not authorization to invent a replacement geometry graph.

## Product contract

### Product identity

- built-in template id: `builtin:electrical-cabinet`
- template version: `1`
- product title: `Electrical Cabinet`
- canonical project id after materialization remains the template source project identity unless normal materialization rules require only conversation identity to be fresh;
- each created project receives a fresh conversation/revision lineage;
- template provenance is audit metadata only.

### Customer-facing controls

D1 exposes a bounded product surface rather than every internal construction parameter.

Required customer controls:

1. Width — nominal default 800 mm.
2. Height — nominal default 1200 mm.
3. Depth — nominal default 300 mm.
4. Sheet thickness — nominal default 2 mm.
5. Door opening angle — exact canonical id `doorOpenAngleDeg`, default 0°, range 0–120°.

The recovered accepted 39-node source fixes the canonical customer-control identities and geometry ranges:

- Width: \`W\`, default 800 mm, range 300–2000 mm, step 10 mm.
- Height: \`H\`, default 1200 mm, range 400–2500 mm, step 10 mm.
- Depth: \`D\`, default 300 mm, range 150–600 mm, step 10 mm.
- Sheet thickness: \`sheet_t\`, default 2 mm, range 1–5 mm, step 0.5 mm.
- Door opening angle: \`doorOpenAngleDeg\`, default 0°, range 0–120°, step 5°.

D1 preserves these accepted IDs rather than renaming or recreating them.

Other recovered published controls — \`door_clear\`, \`plate_margin\`, \`rail_inset\`, \`rail_spacing\` and \`vent_pitch\` — are internal-by-default for D1. They may be exposed only when product evidence shows that they are meaningful customer decisions, remain M0-effective and have a coherent presentation contract. D1 does not expose controls merely because the historical agent happened to publish them.

### Presentation

The five required controls are grouped as:

- Dimensions: Width, Height, Depth, Sheet thickness.
- Door: Door opening angle.

Door opening angle must be understandable as a stateful interaction:

- 0° = closed;
- 90° = visibly open;
- values between the accepted bounds = intermediate opening positions.

The template preview must show the actual D1 cabinet rather than a generic placeholder.

## Geometry boundary

D1 starts with the accepted canonical BRep surface.

No new BRep operation is pre-authorized.

Historical disconnected-union cabinet failures remain classified as authoring/product-path failures. Boolean `union` must not be used to disguise intentionally disjoint multi-body geometry, and project-object auxiliary geometry roles must not be abused as an alternate primary result.

If the recovered accepted cabinet no longer passes the current authoritative validator, classify the failure before changing the language:

1. source recovery/version drift;
2. authoring/model graph defect;
3. product presentation/UX issue;
4. runtime/kernel issue;
5. genuine representation gap.

Only a concrete class-5 representation gap may open a separate minimal geometry-capability decision.

## D1 acceptance contract

D1 is complete only when one exact D1 template version proves all of the following.

### Identity and static validation

1. `builtin:electrical-cabinet@1` resolves exactly and deterministically.
2. C5 static validation passes.
3. All visible controls are effective under M0 integrity analysis.
4. Catalog source and definition digests are deterministic.
5. Duplicate id/version and malformed presentation behavior remain fail-closed.

### Native CAD authority

6. Catalog-wide authoritative native validation includes the real D1 entry.
7. The pinned build123d/OCCT evaluator succeeds on the exact default source.
8. Default result kind matches the validated template contract.
9. Exact STEP export is available.
10. The exported STEP independently re-imports in the pinned native environment.
11. At least one non-default customer parameter recomputes authoritative geometry.
12. `doorOpenAngleDeg: 0 -> 90` is the mandatory D1 perturbation unless the recovered source proves a stricter equivalent product test.
13. The 0° and 90° results are both valid authoritative geometry and measurably different.

### Product lifecycle

14. The template is discoverable through the normal catalog/discovery surface.
15. Creating from exact id/version creates a fresh project/conversation lineage.
16. The created project contains a complete canonical source snapshot.
17. The project reloads through the ordinary BRep project route.
18. Saving a parameter change creates a new immutable revision.
19. The saved non-default revision reloads with the changed value and authoritative geometry.
20. Template provenance records exact id/version/source digest.
21. Provenance remains descriptive/audit metadata and does not become source authority.
22. After materialization, ordinary evaluation/edit/reload does not require the template catalog.
23. Removing or replacing the catalog object in a test harness does not mutate or invalidate the already-created project snapshot.

### Regression and CI

24. Existing template-foundation tests remain green.
25. Existing BRep integrity/native-evaluation tests remain green.
26. `quality` is green on the exact D1 head.
27. `grasshopper-interoperability` is green on the exact D1 head.
28. No Rhino/GHX product acceptance is added unless D1 changes or makes a new claim about that boundary.

## Implementation sequence

Implementation must occur in this order:

1. recover and archive the exact accepted 39-node canonical source;
2. verify it unchanged with current normalization/M0/native evaluation;
3. classify any discrepancy before modification;
4. lock exact parameter IDs and presentation ranges from recovered source;
5. add the repository-owned D1 template definition and real preview;
6. add product-specific D1 static/native/export tests;
7. add discovery/create/reload/revision/provenance/no-catalog-dependency acceptance;
8. run protected gates;
9. close D1 only from exact evidence.

This document deliberately does not authorize D2, D3 or any new general BRep capability.
