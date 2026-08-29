# Editable AI instructions and runtime limits

## Goal

Make pCAD/Brepia AI behavior user-configurable without turning security, data integrity, or backend capability checks into prompt settings.

The same user-facing profile operations should be available wherever a model-facing instruction is configurable:

- view Original
- Override (full replacement while keeping Original recoverable)
- Overlay (append instructions where meaningful)
- Copy
- New profile
- Set as default
- Reset to Original

## Instruction registry

The canonical list lives in `shared/aiInstructionCatalog.ts`.

Initial instruction keys:

- `parametric` — Generative/Parametric system prompt
- `creative` — Creative system prompt
- `tool.build_parametric_model`
- `tool.answer_user`
- `tool.create_mesh`
- `vision.reference`
- `vision.inspection`
- `conversation.title`
- `suggestions.parametric`
- `suggestions.creative`
- `context.parametric_attachment`
- `context.mesh_preferences`
- `context.parametric_inspection_output`

Existing `prompt_profiles` remains the compatibility basis for the two primary prompts while the generalized registry is introduced. New auxiliary instruction profiles should use the same Original/Override/Overlay/Copy/New semantics and eventually share one reusable Settings editor.

## Runtime limits

Runtime behavior that is configurable should be represented as validated typed values rather than prompt text. Initial keys are also declared in `shared/aiInstructionCatalog.ts`.

Examples:

- Generative/Creative max step count
- reasoning token budget
- max output token budgets
- vision timeout, temperature, and output budgets
- Creative runtime health/image/mesh timeouts
- supported TRELLIS.2 resolution

Every value must have server-side validation and a recoverable built-in default.

## Hard invariants

The following are deliberately not user-overridable:

- authentication and authorization
- Supabase row/storage ownership checks
- database integrity and schema validation
- backend-advertised capabilities
- tool input/output schemas required for application interoperability
- binary/file integrity validation

A setting may tune a supported backend option, but it may not claim an unsupported capability. For example, a supported TRELLIS.2 resolution may be selected, but an unsupported reference-image count may not be invented in Settings.

## Implementation sequence

### Step 1 — Registry and semantics

- central instruction/runtime catalog
- define Override as a full replacement profile while retaining immutable Original
- keep Overlay available for additive customization
- align Generative and Creative wording/actions: Override, Overlay, Copy, New, Default, Reset

### Step 2 — Generalized instruction persistence

- add generic active/default profile mapping instead of one database column per future instruction
- keep `default_prompt_profile_id` and `default_creative_prompt_profile_id` backward compatible
- permit registered auxiliary instruction keys only

### Step 3 — Runtime wiring

Resolve configured instructions at request time for:

- chat system prompts
- tool descriptions
- vision fallback prompts
- title generation
- follow-up suggestions
- model-facing attachment/inspection context

Defaults must reproduce current behavior byte-for-byte when no customization exists.

### Step 4 — Runtime-limit persistence and wiring

- typed schemas
- bounded validation
- Settings editor
- request-time resolution
- original/reset support

### Step 5 — Regression gate

- existing CADAM Original behavior unchanged by default
- existing Creative Original behavior unchanged by default
- old conversations continue to resolve pinned primary prompt profiles
- test/typecheck/lint/build green
- functional smoke for Generative, Creative, vision fallback, and reset-to-original
