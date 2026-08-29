# Editable AI instructions and runtime limits

## Goal

Make pCAD/Brepia AI behavior user-configurable without turning security, data integrity, protocol requirements, or backend capability checks into prompt settings.

The same user-facing profile operations are used wherever a model-facing instruction is configurable:

- view the bundled repo template
- Replace (full replacement of effective behavior)
- Overlay (append instructions where meaningful)
- Copy
- New profile
- Edit existing custom profiles
- Set as active/default
- Archive an inactive custom profile

There is deliberately no `Reset to Original` operation. Shipped templates live as versioned files in the repository. If a user wants to reuse a bundled instruction they copy that template into a normal editable profile and activate the copy.

A bundled template may be the initial effective value for a new user whose preference row has never selected a custom profile. Once a custom profile is active, Settings and the preferences API do not provide a reset-to-null path back to the bundled template.

## Repository configuration is the source of truth

No shipped prompt body or configurable runtime default should live as a duplicated TypeScript string/constant.

- `config/ai/instructions/manifest.json` declares available instruction surfaces.
- `config/ai/instructions/*.md` contains shipped instruction templates.
- `config/ai/runtime.json` contains shipped runtime defaults, types and allowed ranges/options.
- TypeScript loads and validates those files; it does not duplicate their contents.

Adding a new instruction normally requires a manifest entry plus a Markdown template, not a database migration or another hardcoded Settings list.

Current registered instruction keys:

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
- `context.creative_reference_mesh`
- `context.mesh_preferences`
- `context.parametric_inspection_output`
- `transport.opencode`
- `transport.codex`
- `provider.fal.image_conditioning` — optional fal.ai provider conditioning

`prompt_profiles` is the shared persistence layer for primary and auxiliary instruction profiles. Generalized scopes use the same Replace/Overlay/Copy/New semantics and the same Settings editor model.

## Runtime limits

Runtime behavior that is configurable is represented as validated typed values rather than prompt text. Definitions and shipped values live in `config/ai/runtime.json`.

Currently wired values include:

- Generative/Creative max step count
- reasoning token budget
- Generative/Creative max output-token budgets
- vision timeout, temperature and output budgets
- Creative runtime health/image/mesh timeouts
- supported TRELLIS.2 resolution
- OpenCode request timeout
- OpenCode/Codex CLI timeout
- OpenCode validation-attempt count

The repository JSON supplies the initial value. The Runtime Settings editor persists explicit validated user choices. There is no dedicated reset control.

Provider-specific runtime knobs are exposed only after their runtime path actually consumes them. Do not add Settings fields merely because a legacy constant exists.

## Request-time performance model

AI settings are resolved as a request snapshot:

1. load the user's AI preferences once
2. collect all selected custom auxiliary instruction-profile IDs
3. bulk-load those profiles in one `prompt_profiles` query
4. resolve all tools, context, title/suggestion and transport instructions from the in-memory snapshot for the rest of the turn

If every auxiliary instruction uses the bundled repository template, no `prompt_profiles` bulk query is issued for the auxiliary snapshot.

Conversation-pinned primary Generative/Creative profiles are intentionally resolved by explicit ID so an old conversation can continue using the exact profile it was created with, including after that profile has later been archived.

Tool objects themselves are created once per chat turn and reused by every model step/tool call in that turn.

## Profile lifecycle rules

- bundled templates are read-only repository references
- custom profiles can be Replace or Overlay profiles
- an active/default custom profile cannot be archived
- the user must activate another custom profile first
- archive is soft removal, not hard delete
- archived profiles disappear from normal Settings lists
- an old conversation explicitly pinned to an archived primary profile can still resolve it
- new defaults cannot point to archived or bundled/read-only profile IDs

These rules avoid an implicit hidden fallback to the bundled template.

## Technical invariants

These are application correctness/security boundaries, not AI behavior settings, and therefore remain fixed application logic:

- authentication and authorization
- Supabase row/storage ownership checks
- database integrity and schema validation
- provider safety/moderation controls
- backend-advertised capabilities and unsupported input combinations
- tool input/output schemas required for application interoperability
- OpenCode/Codex structured result protocol required by the parser
- binary/file integrity validation

A configurable setting may tune a supported backend option, but it may not claim an unsupported capability. For example, a supported TRELLIS.2 resolution may be selected, but an unsupported reference-image count may not be invented in Settings.

## Implemented runtime wiring

The current architecture resolves configured instructions at request time for:

- Generative and Creative system prompts
- model-facing tool descriptions
- vision fallback reference and inspection prompts
- conversation title generation
- Generative/Creative follow-up suggestions
- model-facing attachment, mesh-preference and inspection context
- OpenCode transport behavior
- Codex transport behavior
- optional fal.ai image-conditioning behavior

The TRELLIS.2 core does not depend on the optional fal.ai provider.

## Remaining provider-specific follow-up

The optional legacy fal.ai implementation in `src/server/falMesh.ts` still contains provider-internal heuristics that predate the generalized instruction system, notably:

- caption genericization used in the quality segmentation path
- the SAM text prompt used to select model objects
- provider-specific numeric heuristics/caps such as textureless polygon cap, SAM confidence threshold and Meshy default polycount

These are deliberately **not exposed in Settings yet**. They should be moved into provider-specific instruction/runtime definitions only when `falMesh.ts` is refactored to consume those definitions. This prevents Settings entries that appear configurable but do nothing.

Security controls such as provider moderation/safety tolerance remain non-user-configurable.

## Regression gate

Before closing this checkpoint:

- apply pending Supabase migrations
- regenerate local Supabase TypeScript types
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- verify Generative prompt Copy/New/Replace/Overlay/default behavior
- verify Creative prompt Copy/New/Replace/Overlay/default behavior
- verify an auxiliary instruction profile can be copied/replaced and affects a new request
- verify Runtime Settings persist and influence a new request
- verify normal TRELLIS.2 Creative generation remains healthy
- verify an inactive profile can be archived but an active profile cannot

After this gate, the provider-specific fal.ai legacy refactor can be handled as a separate bounded follow-up without reopening the core instruction architecture.
