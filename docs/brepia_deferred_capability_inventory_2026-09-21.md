# Brepia deferred capability and historical candidate inventory — 2026-09-21

Status: RECONCILED INVENTORY — informational planning authority only. Nothing in this document is automatically active.

Repository: weaf/brepia

Reconciled baseline:

    7b125730174f3537b4b55ce7ef6314f7ec7e4024
    Merge pull request #50 from weaf/feature/brep-planar-elbow-sweep

Current roadmap:

- docs/brepia_maturity_productization_roadmap_2026-09-21.md

Primary historical sources reconciled for this inventory:

- docs/brep_modeling_capability_expansion_plan.md
- docs/brep_post_m4_scope_decision_2026-09-11.md
- docs/brep_post_m6_scope_decision_2026-09-11.md
- docs/brep_post_m3c_scope_decision_2026-09-11.md
- docs/brep_post_m3d_scope_decision_2026-09-12.md
- docs/brep_post_revolve_scope_decision_2026-09-12.md
- docs/brep_post_phase9_multiloop_scope_decision_2026-09-14.md
- docs/brep_product_gap_audit_status_2026-09-19.md
- docs/brep_post_product_gap_scope_decision_2026-09-19.md
- docs/brep_ai_context_budget_plan.md
- docs/brep_phase9_rhino_acceptance.md
- docs/brep_sweep_status_2026-09-21.md

## Purpose

Brepia has accumulated many historical planning documents. Some describe work that is now complete, some describe ideas that were deliberately deferred, and some describe product failures that were later shown to be authoring problems rather than missing geometry.

This inventory prevents old roadmap language from being mistaken for an active task.

Use these status classes:

- COMPLETE — implemented and accepted; not backlog.
- DEFERRED — intentionally not selected; requires new evidence/decision.
- CANDIDATE — potentially valuable, but never accepted as next work.
- PRODUCT/AUTHORING GAP — current product behavior may need improvement, but the evidence does not justify a new canonical geometry operation.
- NOT JUSTIFIED — explicitly investigated and rejected on current evidence.
- NEW ROADMAP ITEM — newly proposed in the 2026-09-21 productization roadmap, not an old commitment.

# 1. Major historical capability work that is already complete

These items must not be reintroduced as future roadmap work merely because older files still describe them as next steps.

## Canonical/modeling platform

COMPLETE:

- M0 parameter effectiveness and graph integrity;
- M1 bounded scalar expression AST and unit algebra;
- M2 union/intersection with exact-one-body semantics;
- M3A mirror;
- M3B bounded linear pattern;
- M3C bounded rectangular pattern;
- M3D bounded circular/polar pattern;
- M4 inline rectangle/circle/closedPolyline profiles and centered extrusion;
- bounded multi-loop extrusion with ordered holes;
- M6 non-zero Intrinsic XYZ transform rotation parity;
- bounded full 360-degree revolve;
- existing semantic fillet selector boundary;
- bounded planar 90-degree circular sweep;
- exact native STEP;
- 3DM/GHX interoperability under the accepted boundary;
- strict parameter-only returned-GHX acceptance;
- single | instanceSet result discipline with narrow collection consumption.

## Rhino / Grasshopper product loop

COMPLETE:

- current-product GHX export;
- installed Rhino 8 / Grasshopper open/solve;
- parameter changes;
- save/close/reopen;
- returned GHX strict validation;
- immutable imported revision;
- explicit activation;
- native preview after activation;
- continued Brepia AI editing;
- fresh GHX export and installed-host reopen.

Phase 9 is closed.

## AI/context track

COMPLETE:

- C1 context observability;
- C2 compact provider schema;
- C2.5 Native BRep runtime/CAD specialization;
- C3 model-context projection;
- C5 hard model-aware context budget;
- C6 deterministic projection of superseded BRep build reasoning.

The old context plan may state that M2 was not started. That statement is historical; M2 and later modeling work were subsequently completed.

# 2. Explicitly deferred geometry/modeling capabilities

## D1 — M5 wall/shell/thickness semantics

Status: DEFERRED.

Historical motivation:

- enclosures;
- hollow housings;
- thin-wall parts;
- graph compression for walls/plates/shells.

Why it was deferred:

- many current thin-wall forms are already representable through derived dimensions, profiles, extrusion and Boolean subtraction;
- shell would often compress a graph rather than add a genuinely new representable class;
- OCCT offset/shell behavior is geometry-sensitive;
- Rhino/native parity risk is higher;
- useful shell workflows quickly raise retained/removed-face semantics;
- persisted raw face IDs are forbidden.

Product-gap Target A did not prove shell/thickness was required. Its generated enclosure failed exact-one-body/authoring semantics, but the audit explicitly did not select M5 from that evidence.

Reopen only when:

- a real product is materially inadequate or unreasonably pathological with explicit inner/outer geometry;
- the gap is not merely verbosity;
- a bounded kernel-neutral offset/shell contract can be defined without fragile topology identity.

## D2 — M7 finishing/topology expansion

Status: DEFERRED.

Includes historical candidates such as:

- chamfer;
- richer fillet selectors;
- broader semantic edge selection;
- broader semantic face selection;
- topology-sensitive finishing.

Why it was deferred:

- the durable problem is stable semantic topology selection, not adding another operation name;
- raw edge/face indices are not acceptable canonical authority;
- selectors must remain meaningful after parameter perturbation;
- OCCT and Rhino topology/failure behavior must agree at the semantic boundary;
- the product corpus was not blocked by missing chamfer.

Reopen only when:

- a real product materially needs the finishing operation;
- a topology-neutral or semantically stable selector can be defined;
- native/Rhino perturbation acceptance can prove selector stability.

## D3 — partial-angle and arbitrary-axis revolve

Status: DEFERRED.

Current accepted revolve remains:

- full 360 degrees;
- canonical X/Y/Z axis;
- one bounded profile;
- one solid result.

Deferred breadth includes:

- start angle;
- partial/swept angle;
- arbitrary vector axis;
- topology-attached axis.

Why deferred:

- no accepted product demonstrated that full revolve was insufficient;
- arbitrary axes broaden frame semantics;
- topology-attached axes introduce reference-stability problems.

Product-gap Target B did not justify these features. The failure was AI authoring: the model used the accepted axial/radial frame incorrectly.

Reopen only from a concrete rotational product that cannot be represented faithfully using full revolve plus transforms/Booleans.

## D4 — multi-loop revolve

Status: DEFERRED.

Multi-loop extrusion is accepted, but revolve profile holes remain outside the accepted first revolve slice.

Why deferred:

- many hollow/stepped turned parts remain expressible with one closed cross-section or Boolean composition;
- no accepted rotational fixture proved multi-loop revolve was necessary.

Reopen only with a real turned product that cannot be represented reasonably with accepted full revolve plus Boolean composition.

## D5 — reusable sketch/profile graph values

Status: DEFERRED.

Historical candidate:

- reusable profile definitions;
- sketch-like non-solid graph entities;
- references from multiple features.

Why deferred:

- inline profiles already cover accepted products;
- reusable sketches would introduce a new non-solid graph value;
- dependency/type semantics would become materially broader than the current solid graph;
- it tends to pull the design toward constraints and topology references.

Reopen only when repeated/reused profile fixtures show material product benefit that cannot be handled cleanly through templates or ordinary canonical duplication.

## D6 — reusable path graph values

Status: DEFERRED.

The accepted sweep stores its one bounded path inline.

Deferred:

- reusable path nodes;
- path/sketch graph values consumed by multiple features;
- general curve graph authority.

Why deferred:

- the accepted Target-E gap was closed without a new graph value;
- a reusable curve/path graph would broaden canonical typing and dependencies considerably.

Reopen only when real products require path reuse independently of a single bounded feature.

## D7 — arbitrary/reference planes and general workplanes

Status: DEFERRED.

Historical candidates:

- explicit arbitrary workplanes;
- reference planes;
- topology-attached planes;
- arbitrary extrusion vectors.

Why deferred:

- canonical X/Y/Z creation plus ordinary rigid transform already covers much geometry;
- explicit planes mainly improve authoring convenience for current targets;
- topology-attached planes have a much larger reference-stability problem.

Reopen when a product demonstrates a geometry limitation, not merely inconvenience, under transform-after-feature semantics.

## D8 — general collection algebra

Status: DEFERRED.

Current accepted collection boundary:

- single;
- instanceSet;
- final patterns may remain lists;
- subtract.tools may consume ordered instance sets under the accepted rules.

Historically deferred breadth includes:

- nested patterns;
- pattern(instanceSet);
- arbitrary collection consumers;
- implicit union/fuse of instance sets;
- general arrays/collections as canonical values.

Why deferred:

- dedicated bounded linear/rectangular/circular patterns closed known repetition gaps without introducing a general collection language;
- collection nesting would greatly broaden value-kind/cardinality semantics.

Reopen only when a real product needs composition that cannot be expressed with the current dedicated pattern and Boolean boundaries.

## D9 — broader pattern families

Status: CANDIDATE / DEFERRED.

Historically excluded examples include:

- three-axis/volumetric patterns;
- arbitrary pattern vectors;
- staggered grids;
- skipped/masked instances;
- pattern-level rotation beyond accepted circular-pattern semantics.

No such family is currently selected.

## D10 — general sweep/path modeling

Status: DEFERRED AFTER BOUNDED SWEEP CLOSEOUT.

The accepted sweep is intentionally only:

- circular profile;
- one planar line + tangent 90-degree circular arc + line;
- fixed X/Y/Z canonical plane frame;
- constant section;
- one solid result.

Still deferred:

- arbitrary path point arrays;
- arbitrary bend angle;
- multiple bends;
- non-planar rails;
- closed paths;
- rectangle/closedPolyline sweep profiles;
- profile holes during sweep;
- variable section;
- multi-section sweep;
- twist;
- Frenet/roadlike choices;
- guide rails;
- general path self-intersection machinery.

The original path-based Target E is now closed by the bounded sweep. None of the broader sweep features is automatically next.

Reopen only from a concrete product such as a cable routing/duct/rail variant that cannot be represented with the accepted elbow slice.

## D11 — richer sketch/curve language

Status: DEFERRED.

Historically outside accepted slices:

- open profiles;
- spline/NURBS profile authoring;
- sketch constraints;
- arbitrary curve graphs;
- general curve editing.

No current product evidence selects these capabilities.

## D12 — domain-specific wall nodes

Status: DEFERRED.

A domain-specific wall primitive was explicitly excluded in older planning.

Reason:

- generic profile/extrusion/Boolean/transform semantics already represent ordinary wall-like geometry;
- domain-specific nodes would narrow the canonical language around one product domain.

A product-template layer is now preferred before reconsidering domain-specific canonical geometry nodes.

## D13 — raw topology identities

Status: DO NOT IMPLEMENT UNDER CURRENT ARCHITECTURE.

Persisted raw Rhino/build123d/OCCT edge or face indices have repeatedly been rejected as canonical authority.

Any future topology-sensitive feature must use a separate semantic/stability design.

# 3. Deferred AI/context work

## C4 — image-context projection

Status: DEFERRED BY EVIDENCE, NOT CANCELLED.

Why:

- representative C3/C5/C6 Native BRep runs contained zero images;
- historical image payload was not the measured context bottleneck.

Reopen only when an image-bearing conversation demonstrates material historical image cost.

A future C4 should preserve required current/relevant images while removing superseded image history. It must not replace necessary image authority with an unverified generated summary.

## AI-generated rolling summary

Status: NOT JUSTIFIED ON CURRENT EVIDENCE.

C6 recovered substantial context headroom deterministically while preserving user-authored history.

Do not implement a rolling AI summary merely because conversations become long.

Reconsider only if measurements show that older user-authored natural-language history itself becomes the material context bottleneck.

# 4. Known product/AI-authoring gaps that are not proven geometry gaps

These are important candidates for the maturity review and product-quality work.

## P1 — enclosure / exact-one-body authoring

Historical Target A:

- canonical graph was reachable and parameters were effective;
- authoritative native union produced multiple solids and failed exact-one-body semantics.

Classification:

PRODUCT/AUTHORING GAP / capability ambiguity.

It did not prove shell/thickness was required.

Review during maturity/product work:

- placement/composition quality;
- AI repair behavior for disconnected intended unions;
- better product-specific authoring guidance;
- whether real enclosure templates reveal an actual M5 need.

## P2 — revolve profile semantic correctness

Historical Target B:

- native geometry succeeded;
- AI authored the accepted revolve profile frame incorrectly;
- axial/radial physical meaning was wrong.

Classification:

PRODUCT/AUTHORING GAP, not a missing revolve operation.

Review:

- tool instructions;
- semantic validation/diagnostics;
- examples/fixtures for turned parts;
- whether product templates can constrain common correct forms.

## P3 — flange parameter-authoring quality

Historical Target C was representable and successful.

Observed non-blocking quality concerns included:

- extra published parameters beyond the explicit request;
- an unspecified central opening dimension derived from the bolt-circle diameter.

Classification:

AUTHORING QUALITY.

Review:

- parameter minimality;
- avoid surprising coupling;
- user-facing independent versus derived dimensions.

## P4 — cabinet placement/composition and pattern use

Historical Target D:

- AI generated disconnected unions;
- repeated shelves were manually transformed instead of using the accepted pattern operation.

Classification:

PRODUCT/AUTHORING GAP, not a missing cabinet primitive.

Review:

- use of existing patterns;
- spatial reasoning;
- exact-one-body intent;
- product-template constraints;
- stronger repair/semantic checks.

The newer working electrical cabinet with movable door is positive evidence that the product surface has advanced beyond this older audit fixture, but the general authoring-quality lessons remain relevant.

## P5 — path-based Target E

Historical Target E originally demonstrated a true representation gap.

Status: COMPLETE / CLOSED.

The bounded planar circular sweep now produces a one-node canonical sweep through the real authenticated product path. Do not keep Target E on the future backlog.

# 5. Known test/runtime follow-up candidates

## T1 — Phase 9 automated finalize harness robustness

Status: CANDIDATE TECHNICAL DEBT.

Installed-host Phase 9 product acceptance is complete.

The automated finalize harness retained robustness assumptions around:

- revision-history remount/collapse after activation;
- retries leaving a previously imported revision active;
- positional newest/first revision assumptions after repeated attempts.

Historical docs explicitly classify these as test-harness robustness issues, not product acceptance gaps.

Phase A should decide whether the harness is still worth repairing or whether a newer acceptance path supersedes it.

## T2 — long-lived runtime build-output ownership

Status: ACTIVE REVIEW ITEM.

A long-lived stable runtime can break when the same working tree rebuilds/replaces .output underneath it.

This has already been observed operationally.

Phase A should define the durable lifecycle/isolation rule rather than treating each incident as an ad hoc restart problem.

## T3 — fixed-port test collisions

Status: ACTIVE REVIEW ITEM.

The recent isolated Dquark browser-smoke attempt collided with an unrelated Noty-create process on fixed port 4173, while the authoritative isolated GitHub Quality Gate passed.

Phase A should decide whether:

- smoke ports become configurable;
- Dquark preflight reserves/checks ports;
- tests remain CI-only when fixed ports are intentional.

Do not terminate unrelated product runtimes merely to satisfy Brepia tests.

# 6. New roadmap items introduced after sweep

These are NEW ROADMAP ITEMS, not historical deferred commitments.

## N1 — Maturity & Stability Review

Selected next activity.

Analysis first; no implementation until findings are accepted.

## N2 — Foundation Hardening

Planned, but contents are determined only from Phase A evidence.

## N3 — Product Template Foundation

Planned after the platform baseline is accepted.

Key conceptual distinction:

- Template = reusable, versioned product definition.
- Project = independent user/product instance with its own immutable revision lineage.

Exact persistence/design remains to be decided.

## N4 — First Product Pack

Planned initial products:

1. Electrical Cabinet — reference complex product and current successful working model.
2. Cable Tray — fabricated linear/patterned product family.
3. Cable Conduit / Pipe — circular product that exercises the accepted sweep in a real product.

These products should first attempt to use the current geometry platform.

They do not pre-authorize shell, broader sweep, arbitrary planes or another BRep operation.

## N5 — product-driven BRep evolution

Standing future policy.

When a product is blocked:

    reproduce
    -> classify authoring vs representation
    -> choose minimum capability
    -> lock boundary
    -> repository/native/Rhino/product acceptance
    -> closeout

# 7. Reopening rule for every deferred item

A deferred capability may be reconsidered only when at least one of the following is true:

1. a real product is not faithfully representable;
2. the accepted representation is measurably pathological enough to become a product blocker;
3. a current runtime/interoperability mismatch exists;
4. a security/correctness issue requires a change;
5. new measured context/runtime evidence invalidates the old decision.

Before implementation, create a fresh scope decision that records:

- the current product evidence;
- why existing capabilities are insufficient;
- the smallest bounded slice;
- explicit exclusions;
- acceptance gates;
- preserved architecture.

Historical roadmap priority alone is never sufficient reason to activate a deferred capability.
