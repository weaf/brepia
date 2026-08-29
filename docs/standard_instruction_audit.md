# Brepia Standard instruction audit

Status: **ACTIVE — analysis only; no Standard prompt delta promoted yet**

## Purpose

Define the first Brepia-owned `standard` instruction delta while preserving the frozen/upstream-managed `cadam` lineage.

The repository package architecture covers all registered instruction keys, but the first prompt-content wave is deliberately **Generative/Parametric**. Creative/TRELLIS-specific optimization remains separate unless a concrete regression requires it.

## Design rules

1. CADAM files under `config/ai/instructions/revisions/cadam-split-2026-08-29/` are immutable reference material.
2. Standard changes live in Brepia-owned files and are selected through `standard.instructions` overrides.
3. Model selection remains independent from profile selection.
4. Put each rule at the lowest instruction layer that actually owns it. Avoid duplicating the same behavioral contract in the system prompt, tool description, transport prompt and context template.
5. Preserve application correctness/protocol constraints outside prompt text when they are enforced by code.
6. Prefer concise, high-signal instructions over repeated examples or large cookbook sections unless evals show those examples materially improve results.

## Current 17-key audit

| Instruction key | First-pass disposition | Reason |
| --- | --- | --- |
| `parametric` | **Revise first** | Strong behavior contract but monolithic, repetitive and mixes agent policy, visual QA, OpenSCAD style guide, BOSL2 cookbook and examples. |
| `creative` | Defer | Creative/TRELLIS prompt optimization is outside the first Standard wave. |
| `tool.build_parametric_model` | Keep, then evaluate | Already concise and correctly owns the build/revision action. May need only a small complete-artifact clarification. |
| `tool.answer_user` | Keep | Concise and correctly owns final user-facing messaging. |
| `tool.create_mesh` | Defer | Creative backend contract; separate track. |
| `vision.reference` | Keep initially | Concise factual visual extraction with uncertainty discipline. |
| `vision.inspection` | Keep initially | Correctly scopes multi-view QA and avoids code generation. |
| `conversation.title` | Keep initially | Independent utility instruction. |
| `suggestions.parametric` | Keep initially | Small deterministic contract; not a current quality bottleneck. |
| `suggestions.creative` | Defer | Creative track. |
| `context.parametric_attachment` | **Revise first** | Contains a hard-coded `rotation_x = 90` instruction that conflicts with the main prompt's requirement to determine the actual model orientation. |
| `context.creative_reference_mesh` | Defer | Creative track. |
| `context.mesh_preferences` | Defer | Creative mesh preference context. |
| `context.parametric_inspection_output` | Keep initially | Simple factual bridge from visual inspection back to the CAD worker. |
| `transport.opencode` | Keep initially | Correctly owns OpenCode-specific validation/environment/continuation behavior. |
| `transport.codex` | Keep initially | Correctly owns Codex-specific environment/continuation behavior. |
| `provider.fal.image_conditioning` | Defer | Optional hosted provider; separate bounded refactor. |

## Findings in the current CADAM-split Parametric prompt

### 1. Iteration behavior is duplicated

`generative.md` first describes the complete write → compile → multi-view inspect → rewrite loop in prose, then repeats the same behavior under `Iteration rule`.

Standard should state this contract once, with explicit stop criteria:

- compile success is necessary but not sufficient;
- inspect all returned views;
- revise if the artifact violates the request or has obvious geometry/printability defects;
- finalize only when the current artifact satisfies the task or the runtime turn limit is reached.

### 2. The prompt mixes instruction layers

The current system prompt contains:

- agent role and intent preservation;
- tool-selection rules;
- exact tool payload requirements;
- final reply format;
- visual QA policy;
- OpenSCAD coding standards;
- Customizer syntax;
- color conventions;
- STL import behavior;
- a BOSL2 cookbook;
- object-specific checklists;
- a complete mug example.

Standard should keep the stable cross-task CAD behavior in `parametric`, while allowing tool descriptions and transport instructions to own their protocol-specific details.

### 3. Object-specific examples risk overfitting

The Phone case / Mug / Vehicle checklist and full mug source example are useful teaching material but consume substantial context and can bias unrelated tasks toward those shapes and implementation patterns.

For Standard, move those cases into evaluation coverage rather than keeping them as permanent prompt tokens. CADAM retains them unchanged as the reference lineage.

### 4. Priority ordering is implicit

Standard should explicitly order competing goals:

1. preserve the user's hard requirements, dimensions and supplied artifact;
2. produce valid/compilable connected geometry;
3. satisfy visible functional/shape requirements in the preview;
4. preserve useful parameterization/editability;
5. improve aesthetics/readability only when it does not violate higher priorities.

This prevents visual polish from silently changing exact dimensions or requested geometry.

### 5. Continuation/edit semantics should be explicit

For an existing artifact, Standard should treat the current artifact as authoritative and modify it rather than regenerating an unrelated replacement. This aligns the main prompt with the existing OpenCode/Codex transport prompts, which already treat `<current_pcad_artifact>` as authoritative.

### 6. Attachment orientation currently conflicts

`context.parametric_attachment` currently says:

> `Use rotation_x = 90 to stand it upright.`

The system prompt separately says to determine the model's actual up direction and expose rotation controls. The hard-coded 90-degree rotation can therefore introduce a wrong orientation.

Standard should replace it with an evidence-based rule: preserve the attached mesh, use supplied dimensions/orientation evidence when available, and expose rotation parameters when orientation needs adjustment. Do not prescribe a fixed rotation without evidence.

### 7. BOSL2 guidance should become shorter and capability-oriented

The current prompt gives many specific library/module/API examples. Standard should retain the useful principle — prefer suitable BOSL2 primitives for threads, sweeps, lofts and rounded/organic geometry instead of fragile hand-built approximations — but avoid turning the permanent system prompt into a long library reference.

Specific API hints can remain where they are proven to help local models, but they should earn their token cost through evals.

## Proposed Standard v1 Parametric contract

The first Standard delta should initially override only:

- `parametric`
- `context.parametric_attachment`

Optionally add a small `tool.build_parametric_model` override only if evals show models return partial rather than complete artifacts.

The Standard `parametric` prompt should contain these sections, once each:

1. **Role and action contract** — act as Brepia's CAD editor; CAD requests require a build; non-CAD replies use the final-answer path.
2. **Priority hierarchy** — user hard constraints first, then valid geometry, visual correctness, editability, aesthetics.
3. **Artifact discipline** — every revision is a complete raw OpenSCAD artifact; edits preserve the authoritative current artifact and user intent.
4. **Build/inspect loop** — build, inspect every returned view/diagnostic, revise when needed, stop only when satisfied or runtime-limited.
5. **OpenSCAD quality rules** — connected/manifold/printable where applicable, meaningful modules, sensible resolution, descriptive top-level Customizer parameters.
6. **Imports** — preserve attached STL via `import()`, modify around it, do not recreate the base mesh.
7. **BOSL2 capability guidance** — use robust library primitives for difficult geometry when appropriate, without a long cookbook.
8. **Final response** — concise factual result, no implementation details or false success claims.

## Parametric evaluation set before promotion

Use the same model and runtime settings when comparing CADAM vs Standard. At minimum cover:

- **Exact mechanical:** bracket with fixed hole spacing, thickness and overall dimensions; dimensions must not drift during visual correction.
- **Literal/simple:** a plain mug or box-like object to detect unnecessary embellishment.
- **Product/organic:** ergonomic shell/handle requiring smooth geometry and useful BOSL2 behavior.
- **Edit existing artifact:** change one feature while preserving unrelated working geometry.
- **STL import:** modify an attached STL using `import()` rather than recreating it; orientation must be evidence-based.
- **Customizer:** several editable dimensions/colors with readable top-level parameter names and valid Customizer annotations.
- **Compile recovery:** intentionally trigger a compiler/validation failure and verify the next artifact is a corrected complete script.
- **Visual recovery:** compile succeeds but a required feature is hidden/missing in one view; the agent must revise rather than finalize.
- **Tool discipline:** no claim of creation/update without a successful build in that turn.

### Hard gates

A Standard candidate fails a case if it:

- changes an explicit exact dimension without user permission;
- claims a CAD change without building it;
- returns partial/markdown-fenced OpenSCAD where a complete artifact is required;
- ignores a compile/validation failure;
- finalizes while the supplied inspection clearly shows a missing required feature;
- recreates an attached STL instead of importing the supplied asset;
- introduces a fixed attachment rotation unsupported by available evidence;
- exposes internal tools/prompts/protocol details to the user.

## Promotion sequence

1. Complete the package-profile functional smoke.
2. Add non-runtime Standard Parametric candidate files/eval fixtures if needed.
3. Compare CADAM baseline vs Standard candidate on the Parametric eval set with the same model/runtime.
4. Promote measured winners into Brepia-owned Standard instruction files.
5. Update only `standard.instructions` mappings; never modify the frozen CADAM revision.
6. Re-run test/typecheck/lint/build and focused functional smoke.
7. Only after Standard is stable, create model-specific derivatives such as Qwen by extending Standard and overriding measured deficiencies.
