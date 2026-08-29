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
- `config/ai/instructions/*.md` remains the compatibility/root template set.
- `config/ai/instructions/revisions/<revision>/*.md` contains immutable instruction revisions used by complete AI profiles.
- `config/ai/profiles/manifest.json` declares repository-backed AI profiles, provenance, frozen revisions, inheritance and per-key overrides.
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

## Complete repository-backed AI profiles

Model selection and AI-profile selection are separate dimensions. A model chooses the LLM/agent runtime; a repository-backed AI profile chooses the complete Brepia instruction package across all registered instruction keys.

Stable package profiles:

- `cadam` — upstream-managed CADAM lineage.
- `standard` — Brepia-managed default.

Experimental package profile:

- `test` — permanent Brepia laboratory slot. It extends Standard and overrides only instruction keys involved in the current experiment. It may be selected as a user's temporary default while testing, but the repository `defaultProfile` remains `standard`.

CADAM and Standard initially point to the immutable `cadam-split-2026-08-29` revision, but Standard does not extend CADAM live. Future CADAM imports create a new frozen revision and move only the CADAM package pointer. Standard remains unchanged until Brepia deliberately ports a change.

Future Brepia profiles such as `qwen` may extend Standard and override only instruction keys that need a measured model-specific difference. Profiles never select or hard-code a model.

The user's default package is stored in `user_ai_preferences.default_instruction_profile_id`. Conversations pin the package in `settings.instructionProfileId`; existing conversations are snapshotted when the package migration is applied, and a database trigger pins the current default on future inserts unless a client explicitly supplied another package.

Custom UUID-based Prompt Profiles remain a second layer. For each instruction key the repository package provides the base, then the selected Custom Profile can Overlay or Replace that one instruction.

The detailed package/provenance contract is documented in `docs/ai_instruction_package_profiles.md`.

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
2. select the conversation-pinned repository instruction package, falling back to the user's current default only for legacy/unmigrated conversations
3. collect all selected custom auxiliary instruction-profile IDs
4. bulk-load those profiles in one `prompt_profiles` query
5. resolve all tools, context, title/suggestion and transport instructions from the in-memory snapshot for the rest of the turn

If every auxiliary instruction uses the bundled repository template, no `prompt_profiles` bulk query is issued for the auxiliary snapshot.

Conversation-pinned primary Generative/Creative custom profiles are intentionally resolved by explicit ID so an old conversation can continue using the exact profile it was created with, including after that profile has later been archived.

The repository package is pinned independently of those UUID-based custom profiles, so changing the Settings default cannot silently switch an existing conversation from Standard to CADAM, Test or another profile. Repository updates to the selected profile still intentionally evolve that profile across deployments; CADAM and Standard remain isolated from each other's revision pointers.

Tool objects themselves are created once per chat turn and reused by every model step/tool call in that turn.

## Profile lifecycle rules

- bundled templates are read-only repository references
- repository-backed complete AI profiles are defined/versioned in Git, not mutable database rows
- CADAM is upstream-managed; Standard is Brepia-managed
- Test is Brepia-managed and intentionally mutable between experiments
- repository `defaultProfile` remains Standard; Test is never the shipped default
- custom profiles can be Replace or Overlay profiles
- an active/default custom profile cannot be archived
- the user must activate another custom profile first
- archive is soft removal, not hard delete
- archived profiles disappear from normal Settings lists
- an old conversation explicitly pinned to an archived primary profile can still resolve it
- new defaults cannot point to archived or bundled/read-only custom profile IDs

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

The selected repository-backed AI package now supplies the base version for that complete list. The TRELLIS.2 core does not depend on the optional fal.ai provider.

## Remaining provider-specific follow-up

The optional legacy fal.ai implementation in `src/server/falMesh.ts` still contains provider-internal heuristics that predate the generalized instruction system, notably:

- caption genericization used in the quality segmentation path
- the SAM text prompt used to select model objects
- provider-specific numeric heuristics/caps such as textureless polygon cap, SAM confidence threshold and Meshy default polycount

These are deliberately **not exposed in Settings yet**. They should be moved into provider-specific instruction/runtime definitions only when `falMesh.ts` is refactored to consume those definitions. This prevents Settings entries that appear configurable but do nothing.

Security controls such as provider moderation/safety tolerance remain non-user-configurable.

## Previous regression gate

The pre-package instruction architecture gate was verified green on 2026-08-29 after applying its migrations and regenerating Supabase types:

- [x] pending Supabase migrations applied
- [x] local Supabase TypeScript types regenerated
- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`

Functional smoke from that checkpoint still included:

- [ ] verify Generative prompt Copy/New/Replace/Overlay/default behavior
- [ ] verify Creative prompt Copy/New/Replace/Overlay/default behavior
- [ ] verify an auxiliary instruction profile can be copied/replaced and affects a new request
- [ ] verify Runtime Settings persist and influence a new request
- [ ] verify normal TRELLIS.2 Creative generation remains healthy
- [ ] verify an inactive profile can be archived but an active profile cannot

## Package-profile extension gate

**Status: GREEN — completed 2026-08-29.**

The CADAM/Standard package-profile extension was implemented after the green gate above. The local code gate was reported green on 2026-08-29 after the compatibility fixes for legacy `CADAM Original` / `Creative Original` behavior. Prompt content remained unchanged during this gate and model/provider selection was unaffected.

Technical gate:

- [x] apply `20260829150000_instruction_profile_packages.sql`
- [x] regenerate local Supabase TypeScript types
- [x] commit/push the regenerated `shared/database.ts` so repository types match the migrated local database
- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`

Functional package smoke:

- [x] verify existing conversations receive a valid `settings.instructionProfileId` — the successfully applied migration backfills conversations both with and without an existing `user_ai_preferences` row, so no pre-migration conversation is left without a package ID
- [x] verify new conversations pin the selected default package
- [x] switch default Standard → CADAM and verify an already-pinned conversation stays Standard
- [x] verify both CADAM and Standard currently resolve identical split-revision content
- [x] verify Custom Prompt Overlay/Replace still layers correctly over the selected package — focused regression tests in `tests/promptProfilesPackageLayering.test.ts` and `tests/aiInstructionCatalog.test.ts` were reported green locally, and the full `npm test` suite was also reported green

## Next active phase — Brepia Standard Parametric evaluation

The package architecture is no longer a blocker. A permanent repository-backed `test` profile is now the runtime laboratory slot. Its current Parametric and attachment-context overrides mirror the Standard v1 candidate in `config/ai/evals/parametric/`; all other keys inherit from Standard.

- keep CADAM frozen and unchanged
- keep Standard unchanged until a candidate is promoted
- keep repository `defaultProfile` set to Standard
- use Test for experimental runtime instructions
- keep model selection independent of profile selection
- use the same Parametric model/runtime/application revision for CADAM and Test runs
- compare CADAM versus Test in fresh conversations without an additional Custom Prompt Profile
- promote only measured improvements from Test into `standard.instructions`
- after promotion or rejection, reuse Test for the next candidate
- do not add a Qwen/model-family profile until Standard evaluation demonstrates a repeatable model-specific need
- keep Creative/TRELLIS-specific prompt optimization as a separate follow-up

The evaluation protocol, hard gates, scoring dimensions and promotion rule are documented in `config/ai/evals/parametric/README.md`.

After the Parametric Standard candidate is evaluated and promoted or rejected, continue the remaining non-Creative instruction-key audit while leaving the CADAM frozen/upstream lineage intact. The optional fal.ai legacy refactor remains a separate bounded follow-up.
