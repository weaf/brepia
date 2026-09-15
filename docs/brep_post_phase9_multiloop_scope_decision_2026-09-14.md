# Post-Phase 9 / post-multi-loop modeling scope decision — 2026-09-14

Status: **DECIDED — Phase 9 and bounded multi-loop profile extrusion are closed. No new canonical modeling operation is active. The next bounded activity is a product-gap audit over representative Native BRep targets; a new geometry slice may be selected only from a demonstrated representational failure.**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Decision basis

This decision reconciles the current branch after two independent closeouts:

1. bounded multi-loop profile extrusion is complete across repository/CI, pinned native build123d/OCCT runtime and installed Rhino 8 / Grasshopper;
2. Phase 9 current-product round-trip acceptance is complete through real installed Rhino 8 / Grasshopper and the Brepia product UI.

The Phase 9 closeout checkpoint is:

```text
b1e7ea904c57efc3e3ecd697ee19d6d5c69f866b
Close Phase 9 Rhino product-loop acceptance
```

with exact repository CI:

```text
Quality Gate #1122       PASS
Grasshopper Build #694   PASS
```

Phase 9 product/host evidence is recorded separately in:

```text
docs/brep_phase9_rhino8_product_loop_evidence_2026-09-14.md
docs/brep_phase9_rhino_acceptance.md
```

Multi-loop closeout and its separate evidence layers are recorded in:

```text
docs/brep_multiloop_profile_extrusion_status.md
docs/brep_multiloop_native_runtime_evidence_2026-09-12.md
docs/brep_multiloop_rhino8_runtime_evidence_2026-09-14.md
```

## Reconciled accepted modeling surface

The current canonical Native BRep language now has a materially broader product surface than the earlier M0-M6 planning baseline:

- M0 parameter effectiveness and graph integrity;
- M1 bounded scalar-expression AST with deterministic unit algebra;
- primitive box and cylinder solids;
- subtract plus M2 union/intersection with exact-one-body semantics;
- M3A mirror;
- M3B bounded linear pattern;
- M3C bounded rectangular pattern;
- M3D bounded circular/polar pattern;
- `single | instanceSet` value-kind discipline with narrow collection consumption;
- M4 inline rectangle/circle/closedPolyline profiles and centered extrusion;
- bounded multi-loop extrusion with ordered non-recursive holes;
- bounded full revolve;
- semantic fillet selection through the already accepted `parallelToAxis` form;
- M6 non-zero Intrinsic XYZ rotation parity;
- rigid translation/rotation placement and project-object semantics;
- exact native STEP and 3DM/GHX interop paths under their accepted boundaries.

The current surface can already represent the ordinary target families that motivated the modeling expansion: derived parametric solids, mounting plates, patterned holes, flanges, constant-section parts with through-openings, cabinet/equipment arrays, room/opening construction, turned axisymmetric parts, Boolean assemblies and rotated solids.

That changes the burden of proof for the next opcode. A capability should no longer be added because it is common in CAD software; it should be added only when a current product target cannot be represented faithfully and boundedly with the accepted language.

## Why M5 shell/thickness is not activated

M5 remains a plausible future capability, but there is still no accepted target fixture proving that it closes a current representational gap.

The present language can already build many thin-wall/enclosure forms using:

- M1-derived inner dimensions;
- profile extrusion;
- bounded multi-loop openings;
- subtract/union/intersection;
- transforms and patterns.

For those models a shell opcode would primarily compress the graph.

The risk remains materially higher than simple graph compression justifies:

- OCCT shell/offset behavior is geometry-sensitive;
- Rhino and native failure/cardinality behavior must be bounded independently;
- useful shell workflows quickly raise retained/removed-face semantics;
- persisted raw face indices remain forbidden.

**Decision: M5 remains deferred until the product-gap audit produces a concrete model that is materially inadequate without shell/thickness.**

## Why M7 finishing/topology is not activated

Chamfer and richer fillet selection would improve manufacturing polish, but the durable design problem is semantic topology selection rather than adding one more operation name.

The current corpus is not blocked by chamfer, and there is no cross-kernel selector contract yet that justifies broadening the topology surface.

Any future M7 slice must avoid:

- raw edge or face indices;
- kernel-specific topology IDs;
- selectors whose meaning changes after ordinary parameter perturbation;
- silent best-effort selection when the semantic target is ambiguous.

**Decision: M7 remains deferred until a concrete target both requires the finishing operation and demonstrates a kernel-neutral selector that can survive parameter perturbation.**

## Other candidate expansions remain unselected

### Partial-angle / arbitrary-axis revolve

Full bounded revolve is accepted. Partial revolve or arbitrary axes would broaden angular/frame semantics, but no current target demonstrates that the full-revolve boundary is insufficient.

**Decision: defer.**

### Sweep / path-based solids

A bounded sweep could eventually close a genuine gap for pipes, rails, bent ducts or handrails. It would also require explicit path grammar, frame/twist semantics, self-intersection rules and native/Rhino parity.

There is currently no accepted target proving that this should outrank lower-risk alternatives.

**Decision: do not activate; include one path-based target in the audit so the need can be measured rather than assumed.**

### Reusable sketch/profile graph

This would introduce a new non-solid graph value and materially broaden dependency/type semantics. Existing inline profiles remain adequate for the accepted corpus.

**Decision: defer.**

### Arbitrary/reference planes

Topology-free explicit planes may improve authoring ergonomics, but transform-after-extrude/revolve already covers much of the geometry. Topology-attached planes would introduce a much larger reference-stability problem.

**Decision: defer unless the audit proves a geometry—not merely convenience—gap.**

### Multi-loop revolve

Non-empty profile holes remain fail-closed for revolve. That is not automatically a missing product capability: many hollow/stepped rotational parts can be represented by one suitable closed cross-section or ordinary Boolean composition.

**Decision: defer until a concrete rotational fixture proves otherwise.**

### C4 image projection

Image projection remains a separate deferred context/authoring concern and is not selected by this modeling decision.

## Selected next activity — bounded product-gap audit

The next active work is **not a new canonical geometry implementation**.

Run a bounded product-gap audit using the current Native BRep product path and representative targets. The audit must distinguish three outcomes for each target:

1. **representable and reasonable** — current language is sufficient;
2. **representable but materially pathological** — graph size/authoring complexity itself becomes a product blocker;
3. **not faithfully representable** — a real canonical capability gap exists.

A candidate next operation may be selected only from outcomes 2 or 3, with preference for a capability that closes more than one target while adding the least kernel/topology/schema risk.

## Audit corpus

Use at least these five target families.

### A. Hollow enclosure with functional openings

Target characteristics:

- outer enclosure/body;
- controlled wall thickness;
- at least one opening;
- lip/recess or lid interface;
- parameterized overall dimensions and wall thickness.

Question answered:

> Does the accepted expression + profile + multi-loop + Boolean surface remain practical, or is M5 shell/thickness now a demonstrated product gap?

### B. Turned mechanical part

Target characteristics:

- asymmetric stepped radial/axial cross-section;
- groove/recess or bore-like feature;
- at least two independent published dimensions;
- current full-revolve semantics used where appropriate.

Question answered:

> Is bounded full revolve plus Boolean composition sufficient, or is partial/multi-loop/arbitrary-axis revolve actually required?

### C. Fabricated mounting plate / flange

Target characteristics:

- multi-loop plate/profile;
- patterned holes using rectangular or circular pattern as appropriate;
- one existing supported finishing feature where useful;
- dimension perturbation that changes authoritative geometry.

Question answered:

> Is M7 finishing/topology a real blocker, or merely missing visual/manufacturing polish?

### D. Architectural/cabinet layout

Target characteristics:

- derived dimensions through M1;
- repeated elements through M3;
- openings/cutters that must intersect intended material;
- transforms/rotation where appropriate;
- authoritative single result or explicitly justified instance set.

Question answered:

> Does the accepted language solve the original ordinary architectural/orthogonal construction problems without baked relationships or manual repetition?

### E. Bent path-based object

Target characteristics:

- pipe, handrail, bent rail/duct or another form whose defining geometry follows a path;
- one meaningful parameter perturbation;
- no approximation by dozens of unrelated primitives merely to make the fixture pass.

Question answered:

> Is sweep/path modeling the next true representational gap?

## Audit method

For every target:

1. generate/edit through the current Native BRep AI product path rather than hand-authoring a hidden privileged graph;
2. record the exact prompt and model/runtime used;
3. inspect the canonical project rather than relying only on the viewer;
4. require M0 parameter-effectiveness/integrity to remain satisfied;
5. verify published controls drive authoritative geometry;
6. verify native preview/evaluation under at least one non-default parameter perturbation;
7. record node count and the dominant graph pattern so graph-pathology claims are measurable;
8. record any unsupported operation or forced approximation explicitly;
9. do not add a schema workaround during the audit;
10. do not claim Rhino parity for a candidate capability that has not been implemented and accepted separately.

The audit is primarily a repository/product-discovery activity. It does not need to manufacture installed-Rhino evidence for every already-supported target unless the audit exposes an interoperability defect in existing accepted behavior.

## Selection rule after the audit

If a concrete gap is found, rank candidate slices by:

1. number and importance of blocked product targets closed;
2. whether the gap is representational rather than cosmetic/convenience-only;
3. canonical/schema complexity;
4. kernel sensitivity;
5. topology-reference risk;
6. native/Rhino parity risk;
7. AI/provider/context cost;
8. ability to define a small fail-closed first slice.

Prefer the smallest kernel-neutral operation that closes the demonstrated gap.

If all five targets are representable without material pathology, **select no new geometry operation** and shift effort to product quality, generation quality or regression infrastructure instead of expanding the canonical language speculatively.

## Separate non-modeling backlog — Phase 9 Playwright hardening

The Phase 9 product loop is accepted and closed, but the staged Playwright `finalize` harness still has retry-state assumptions around revision-history remounting and positional revision identification.

That is test-infrastructure debt, not a canonical modeling gap.

It may be hardened separately, but:

- it must not weaken immutable revision semantics;
- it must not auto-activate imported GHX revisions;
- it must not weaken strict returned-GHX validation;
- it must not be used as a reason to reopen Phase 9 product acceptance.

## Preserved architecture

This decision preserves:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep project + immutable revision authority;
- build123d/OCCT as authoritative native geometry evaluator;
- Rhino/GHX as interoperability compiler only;
- strict parameter-only returned-GHX import;
- canonical `schemaVersion: 1`;
- M0 effectiveness/integrity semantics;
- M1 bounded scalar AST and unit algebra;
- M2 exact-one-body Boolean semantics;
- M3 `single | instanceSet` discipline and existing collection-consumer rules;
- M3A-M3D pattern/symmetry semantics;
- M4 profile/extrusion semantics;
- bounded multi-loop extrusion semantics;
- bounded full-revolve semantics;
- M6 Intrinsic XYZ rotation semantics;
- existing semantic fillet boundary;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

## Decision

Phase 9 is closed. Bounded multi-loop profile extrusion is closed. No further canonical modeling slice is selected automatically.

The next active scope is a **bounded product-gap audit** over the five target families above.

No shell, chamfer, sweep, partial revolve, reusable sketch, arbitrary plane or other geometry implementation should begin until that audit records a concrete product failure and a separate implementation-boundary decision selects the smallest justified slice.
