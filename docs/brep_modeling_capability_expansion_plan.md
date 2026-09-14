# BRep modeling capability expansion plan

Status: **Historical expansion plan. Current accepted modeling coverage includes M0, M1, M2, M3A, M3B, M3C, M3D, M4 profile/extrusion, M6 non-zero rotation parity, bounded full revolve and bounded multi-loop profile extrusion across their separately recorded repository/CI, native build123d/OCCT and installed Rhino 8 / Grasshopper evidence layers. Phase 9 product-loop acceptance is closed. No new canonical modeling operation is active; `docs/brep_post_phase9_multiloop_scope_decision_2026-09-14.md` selects a bounded product-gap audit before any further geometry expansion. M5 shell/thickness, M7 topology/finishing and C4 image projection remain deferred.**

This file preserves the historical rationale and staged M0-M7 expansion record. For current post-Phase-9 scope, use `docs/brep_post_phase9_multiloop_scope_decision_2026-09-14.md`.

Detailed current status:

- `docs/brep_m0_parameter_integrity_closeout.md`;
- `docs/brep_m1_scalar_expression_closeout.md`;
- `docs/brep_m2_boolean_composition_status.md`;
- `docs/brep_m2_native_runtime_evidence_2026-09-10.md`;
- `docs/brep_m2_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3a_mirror_status.md`;
- `docs/brep_m3a_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3a_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_linear_pattern_status.md`;
- `docs/brep_m3b_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3c_rectangular_pattern_status.md`;
- `docs/brep_m3c_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3c_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3d_circular_pattern_status.md`;
- `docs/brep_m3d_native_runtime_evidence_2026-09-12.md`;
- `docs/brep_m3d_rhino8_runtime_evidence_2026-09-12.md`;
- `docs/brep_m4_profile_extrusion_status.md`;
- `docs/brep_m4_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m4_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m6_rotation_parity_status.md`;
- `docs/brep_m6_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m6_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_revolve_status.md`;
- `docs/brep_revolve_native_runtime_evidence_2026-09-12.md`;
- `docs/brep_revolve_rhino8_runtime_evidence_2026-09-12.md`;
- `docs/brep_multiloop_profile_extrusion_status.md`;
- `docs/brep_multiloop_native_runtime_evidence_2026-09-12.md`;
- `docs/brep_multiloop_rhino8_runtime_evidence_2026-09-14.md`;
- `docs/brep_phase9_rhino_acceptance.md`;
- `docs/brep_phase9_rhino8_product_loop_evidence_2026-09-14.md`;
- `docs/brep_post_phase9_multiloop_scope_decision_2026-09-14.md`.

## Current decision boundary

The accepted language is now broad enough that another operation is not justified by roadmap numbering alone. New modeling semantics must be selected from a concrete product failure, not from a generic CAD feature checklist.

The active next work is therefore a bounded product-gap audit over representative Native BRep targets. It must distinguish:

1. targets that are faithfully and reasonably representable now;
2. targets that are representable only through materially pathological graphs;
3. targets that are not faithfully representable with the accepted language.

Only outcomes 2 or 3 may justify a new canonical operation, and any selected operation still requires a separate implementation boundary plus repository/CI, pinned native runtime and installed Rhino 8 / Grasshopper evidence.

M5 shell/thickness and M7 topology/finishing remain deferred until that audit demonstrates a concrete need. C4 image projection remains a separate deferred context/authoring track.

## Preserved invariants

Preserve throughout future work:

- `conversation.type = 'parametric'`;
- explicit Native BRep routing through `parametricSourceKind = 'brep'`;
- canonical BRep project + immutable revision authority;
- build123d/OCCT remains the authoritative native evaluator;
- Rhino/GHX remains an interoperability compiler, not canonical authority;
- returned GHX stays parameter-only at the supported round-trip boundary;
- canonical `schemaVersion: 1` remains unchanged unless a separately justified migration is explicitly designed;
- no arbitrary Python/expression/code execution in the canonical schema;
- no raw Rhino/build123d edge/face indices as persisted topology authority;
- every newly translated operation remains fail-closed until repository parity tests and real Rhino 8 host evidence exist;
- existing `single | instanceSet` value-kind and collection-consumer rules remain authoritative unless separately broadened;
- OpenSCAD regressions remain preserved.

## Historical M0-M7 rationale

The original modeling expansion track began because real generated projects exposed concrete failures: ineffective published parameters, baked relationships, manual repetition, Boolean-heavy graphs and orphan finishing branches. M0-M4/M6 and the later M3D/revolve/multi-loop slices addressed those observed gaps with bounded, kernel-neutral semantics rather than turning the canonical format into a general-purpose scripting language.

The detailed historical contracts, implementation sequences and acceptance records remain available in the dedicated status/decision/evidence files listed above and in repository history. They should not be interpreted as automatically activating another numbered milestone.

## Deferred candidates

### M5 — wall/shell/thickness semantics

Still deferred. Current expressions, profiles, multi-loop extrusion, Booleans, patterns and transforms already represent the accepted wall/plate/enclosure targets. Shelling/offsetting is kernel-sensitive and becomes topology-sensitive as soon as retained/removed faces are selectable. Reconsider only when the product-gap audit proves material inadequacy of the accepted surface.

### M7 — finishing/topology operations

Still deferred. Chamfer and richer fillet selectors may become useful, but the durable design problem is stable semantic topology selection. Raw edge/face indices remain unacceptable persisted authority. Reconsider only when a concrete target is blocked and a cross-kernel semantic selector can be bounded under parameter perturbation.

### Other possible future gaps

Partial/arbitrary-axis revolve, sweep/path solids, reusable profile/sketch graphs, arbitrary/reference planes and multi-loop revolve are not active. Each requires a separate evidence-based selection and implementation-boundary decision if the product-gap audit demonstrates that the current language is insufficient.

## Product acceptance principle

A parameter existing in the Parameters panel is a product promise. New generation must not expose a parameter unless Brepia can prove, from the canonical dependency graph, that changing it affects an authoritative geometry or explicitly supported semantic output.

A new modeling opcode is likewise a product promise. Do not add one until a real target demonstrates that the accepted language cannot satisfy the product need safely and reasonably.