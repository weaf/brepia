# Brepia Standard instruction audit

Status: **V1 REJECTED — future changes require a concrete measured need**

## Purpose

Preserve the audit history behind the first Brepia-owned `standard` Parametric candidate while keeping the frozen/upstream-managed `cadam` lineage intact.

The first attempt to create a generally cleaner/shorter Standard Parametric prompt did not outperform CADAM in hands-on A/B testing. Therefore the findings below are hypotheses and design observations, not an instruction to change Standard merely for architectural cleanliness.

Creative/TRELLIS-specific optimization remains separate unless a concrete regression requires it.

## Design rules

1. CADAM files under `config/ai/instructions/revisions/cadam-split-2026-08-29/` are immutable reference material.
2. Standard changes live in Brepia-owned files and are selected through `standard.instructions` overrides.
3. Model selection remains independent from profile selection.
4. Put each rule at the lowest instruction layer that actually owns it; avoid unnecessary duplication.
5. Preserve application correctness/protocol constraints outside prompt text when they are enforced by code.
6. A shorter or cleaner prompt is not automatically better. Changes must earn promotion through observed CAD behavior.
7. Do not create a new Standard candidate solely to make Standard different from CADAM. Start from a concrete regression, missing capability, model-specific deficiency or measurable usability problem.

## V1 evaluation result — 2026-08-29

The Standard v1 candidate overrode only `parametric` and `context.parametric_attachment` in the Test profile.

Hands-on CADAM-versus-Test evaluation used the same model/runtime and the same prompts for:

- creation of an exact-dimension L-shaped mounting bracket;
- a constrained follow-up edit moving only the mounting holes while preserving all other dimensions and geometry.

Observed result:

- both profiles produced effectively the same requested geometry;
- both performed the constrained edit correctly;
- CADAM exposed the hole Z offset as an editable parameter while V1 did not;
- CADAM selected a more convenient model origin for interactive rotation;
- V1 demonstrated no compensating improvement in these tests.

Decision: **reject V1 and do not promote it into Standard.** The candidate source remains under `config/ai/evals/parametric/candidates/` as historical evaluation material. The Test profile is reset to inherit Standard with no active overrides.

Further testing of V1 is unnecessary unless a specific scenario is identified where V1 is expected to produce meaningfully different behavior.

## 17-key audit record

| Instruction key | Audit observation | Current action |
| --- | --- | --- |
| `parametric` | CADAM is long and mixes behavior, examples and coding guidance. | **Keep baseline.** Revisit only for a measured problem. |
| `creative` | Creative/TRELLIS behavior is a separate domain. | Defer. |
| `tool.build_parametric_model` | Concise and correctly owns build/revision action. | Keep. |
| `tool.answer_user` | Concise and correctly owns final user-facing messaging. | Keep. |
| `tool.create_mesh` | Creative backend contract. | Defer. |
| `vision.reference` | Concise factual visual extraction with uncertainty discipline. | Keep. |
| `vision.inspection` | Correctly scopes multi-view QA and avoids code generation. | Keep. |
| `conversation.title` | Independent utility instruction. | Keep. |
| `suggestions.parametric` | Small deterministic contract. | Keep. |
| `suggestions.creative` | Creative track. | Defer. |
| `context.parametric_attachment` | Contains a hard-coded `rotation_x = 90` rule that may be wrong for some attached models. | Keep for now; revisit with an attachment-specific failure case. |
| `context.creative_reference_mesh` | Creative track. | Defer. |
| `context.mesh_preferences` | Creative mesh preference context. | Defer. |
| `context.parametric_inspection_output` | Simple factual bridge from visual inspection back to CAD worker. | Keep. |
| `transport.opencode` | Owns OpenCode-specific validation/environment/continuation behavior. | Keep. |
| `transport.codex` | Owns Codex-specific environment/continuation behavior. | Keep. |
| `provider.fal.image_conditioning` | Optional hosted provider. | Defer. |

## Historical findings from the V1 audit

These remain useful hypotheses if future failures point at them:

- the CADAM Parametric prompt repeats parts of the build/inspect/rewrite loop;
- it mixes agent policy, OpenSCAD style, Customizer syntax, BOSL2 guidance and object-specific examples;
- object-specific examples may consume context or bias unrelated tasks;
- the priority between exact user constraints, geometry validity, visual correctness, parameterization and aesthetics is mostly implicit;
- continuation/edit semantics could potentially be made more explicit;
- the attachment context's fixed `rotation_x = 90` can conflict with evidence-based orientation;
- BOSL2 guidance might be shortened if a future model shows context-pressure problems.

None of these observations by themselves justify changing the prompt. V1 showed that a theoretically cleaner prompt can still produce worse practical CAD ergonomics.

## Future evaluation policy

Before loading another candidate into Test, write down the expected improvement. Examples of valid triggers:

- a reproducible CADAM failure on a particular geometry class;
- a repeatable loss of dimensions or unrelated geometry during edits;
- poor parameterization that can be tied to a specific missing instruction;
- attached STL orientation failures;
- compile-recovery or visual-inspection failures;
- excessive context causing a measured model/runtime problem;
- a repeatable deficiency specific to a model family such as Qwen.

Then compare CADAM against Test with the same model/runtime and a test designed specifically around that hypothesis. Promote only if Test gives a clear improvement without introducing regressions elsewhere.

## Promotion sequence for a future candidate

1. Define the concrete problem and expected improvement.
2. Load only the required experimental instruction overrides into Test.
3. Compare CADAM baseline vs Test with the same model/runtime/application revision.
4. Reject the candidate if it is merely equal or introduces a regression without a compensating target improvement.
5. Promote only measured winners into Brepia-owned Standard instruction files.
6. Update only `standard.instructions`; never modify the frozen CADAM revision.
7. Reset Test to its idle state after promotion or rejection.
8. Re-run test/typecheck/lint/build and focused functional smoke.
9. Create model-specific derivatives only after a repeatable model-specific deficiency is demonstrated.
