# Editable AI instructions and runtime limits

## Goal

Make pCAD/Brepia AI behavior user-configurable without turning security, data integrity, or backend capability checks into prompt settings.

The same user-facing profile operations should be available wherever a model-facing instruction is configurable:

- view the bundled repo template
- Replace (full replacement of effective behavior)
- Overlay (append instructions where meaningful)
- Copy
- New profile
- Edit existing custom profiles
- Set as active/default

There is deliberately no `Reset to Original` operation. Shipped templates live as versioned files in the repository. If a user wants to recover an older/default instruction they can view/copy the bundled template into a new or existing profile.

## Repository configuration is the source of truth

No prompt body or runtime default should live as a TypeScript string/constant.

- `config/ai/instructions/manifest.json` declares available instruction surfaces.
- `config/ai/instructions/*.md` contains the shipped instruction templates.
- `config/ai/runtime.json` contains shipped runtime defaults, types and allowed ranges/options.
- TypeScript loads and validates those files; it does not duplicate their contents.

Adding a new instruction should normally require a manifest entry plus a Markdown template, not a TypeScript list or database migration.

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

Existing `prompt_profiles` remains the compatibility basis for the two primary prompts while the generalized profile model is introduced. Auxiliary instruction profiles use the same Replace/Overlay/Copy/New semantics and should share one reusable Settings editor.

## Runtime limits

Runtime behavior that is configurable is represented as validated typed values rather than prompt text. Definitions and shipped values live in `config/ai/runtime.json`.

Examples:

- Generative/Creative max step count
- reasoning token budget
- max output token budgets
- vision timeout, temperature, and output budgets
- Creative runtime health/image/mesh timeouts
- supported TRELLIS.2 resolution

User settings store sparse overrides only. Removing/changing an override does not require a special reset action; the effective value is whatever profile/configuration is currently selected. The repo JSON remains available as a reference/template.

## Technical invariants

These are application correctness/security boundaries, not AI instructions, and are therefore not represented as editable prompt profiles:

- authentication and authorization
- Supabase row/storage ownership checks
- database integrity and schema validation
- backend-advertised capabilities
- tool input/output schemas required for application interoperability
- binary/file integrity validation

A configurable setting may tune a supported backend option, but it may not claim an unsupported capability. For example, a supported TRELLIS.2 resolution may be selected, but an unsupported reference-image count may not be invented in Settings.

## Implementation sequence

### Step 1 — Repository-backed catalog

- externalize instruction bodies to Markdown
- externalize runtime defaults/ranges to JSON
- make the manifest the registry/source of truth
- remove duplicated hardcoded prompt/default values from TypeScript

### Step 2 — Generalized instruction persistence

- add generic active/default profile mapping instead of one database column per future instruction
- keep `default_prompt_profile_id` and `default_creative_prompt_profile_id` backward compatible
- validate auxiliary instruction keys against the repo manifest at the API layer
- database scope validation remains generic so new manifest entries do not require schema migrations

### Step 3 — Runtime wiring

Resolve configured instructions at request time for:

- chat system prompts
- tool descriptions
- vision fallback prompts
- title generation
- follow-up suggestions
- model-facing attachment/inspection context

With no user profile selected, bundled repository templates must reproduce current behavior byte-for-byte.

### Step 4 — Settings UI

Provide one reusable instruction-profile editor with:

- Bundled template view
- Replace
- Overlay
- Copy
- New profile
- Edit/archive custom profiles
- active/default selection

Do not expose a special Reset-to-Original action.

### Step 5 — Runtime-limit persistence and UI

- schema-driven typed controls
- bounded server validation
- sparse persisted overrides
- request-time resolution from user choice + repo configuration

### Step 6 — Regression gate

- default Generative behavior unchanged
- default Creative behavior unchanged
- old conversations continue to resolve pinned primary prompt profiles
- test/typecheck/lint/build green
- functional smoke for Generative, Creative, vision fallback, bundled-template copy and full replacement
