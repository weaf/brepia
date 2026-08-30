# AI instruction package profiles

## Purpose

Brepia separates **model selection** from **AI profile selection**. A model chooses the LLM/agent runtime. An AI profile chooses the complete repository-backed instruction package used by Brepia.

A package can provide versions of every instruction key declared in `config/ai/instructions/manifest.json`, including the primary Parametric and Creative prompts, tool descriptions, vision instructions, context injections, suggestions, transport instructions and provider-specific prompt material.

User-owned Custom Prompt Profiles remain a separate layer. They can still Overlay or Replace one instruction key after the repository package has selected its base template.

## Repository layout

- `config/ai/instructions/manifest.json` declares the stable instruction keys and legacy compatibility template for each key.
- `config/ai/instructions/revisions/<revision>/*.md` contains frozen instruction revisions used by repository profiles.
- `config/ai/profiles/manifest.json` declares named revisions, repository-backed profiles, provenance and package-specific overrides.
- `config/ai/runtime.json` remains independent from profile selection.

A profile can point to a frozen revision and may define only the instruction keys that differ. Missing profile overrides fall through an optional `extends` chain, then the selected frozen revision, and finally the compatibility template declared by the instruction manifest.

## Initial profiles

### CADAM

`cadam` is the upstream-managed CADAM profile. Its provenance is recorded in `lineage`. Future CADAM imports can point CADAM at a new frozen revision without changing Brepia-managed profiles.

### Standard

`standard` is the Brepia-managed default. It records that it originated from the CADAM split revision, but it does **not** extend CADAM live. At the initial split both profiles point to the same immutable `cadam-split-2026-08-29` revision.

This isolation is intentional: a later CADAM sync must never silently change Standard.

## Profile selection and conversation pinning

The user's default repository profile is stored in `user_ai_preferences.default_instruction_profile_id`. It is independent from Parametric/Creative model defaults and from UUID-based Custom Prompt Profiles.

A conversation stores the selected repository profile as `settings.instructionProfileId`. Migration `20260829150000_instruction_profile_packages.sql` snapshots existing conversations and installs a `BEFORE INSERT` trigger that copies the user's current default profile into new conversations when the client has not supplied an explicit profile.

The chat runtime validates the pinned package against the repository manifest and uses the same resolved package for:

- the Parametric or Creative primary system prompt;
- tool instructions;
- vision instructions;
- context injections;
- conversation title and suggestion instructions;
- OpenCode/Codex transport instructions;
- provider instruction material.

Changing the Settings default therefore affects future conversations, not the instruction lineage of conversations already pinned to a package. The trigger deliberately preserves an explicit `instructionProfileId`, so a later per-conversation profile selector can choose a package without changing this persistence model.

## CADAM update rule

When new prompt material is imported from the CADAM project:

1. Create a new named revision directory under `config/ai/instructions/revisions/`; never overwrite a revision used by Standard.
2. Record that revision in `config/ai/profiles/manifest.json`.
3. Update only the `cadam` profile revision/mappings and its lineage metadata.
4. Verify that `standard` still resolves the same frozen revision/content as before the sync.
5. Review useful CADAM changes separately before porting any of them into Standard. Brepia changes are deliberate, not inherited side effects.

## Brepia-derived profiles

Future Brepia profiles such as `qwen` may use `extends: "standard"` and override only the instruction keys for which evaluation demonstrates a useful difference. This keeps model-specific deltas small while improvements to Standard flow to profiles that intentionally inherit it.

A model is never selected by the profile manifest. The user can combine any compatible model with any available profile.

## Resolution order

For one instruction key, runtime resolution is:

1. conversation-pinned repository-backed AI profile;
2. selected profile override for the instruction key;
3. parent Brepia profile override, when `extends` is configured;
4. the frozen instruction revision selected by the first applicable profile;
5. compatibility template from `config/ai/instructions/manifest.json`;
6. optional user Custom Prompt Profile Overlay or Replace for that exact instruction key;
7. template variable rendering.

The package selection therefore affects the whole instruction system, while user customization remains backward compatible.

## Current checkpoint

The initial `cadam` and `standard` profiles intentionally resolve to the same frozen instruction revision. No prompt optimization is part of this checkpoint. The next prompt-content phase can audit all instruction keys and introduce Standard revisions/overrides without changing the CADAM lineage.
