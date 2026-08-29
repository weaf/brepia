# AI instruction package profiles

## Purpose

Brepia separates **model selection** from **AI profile selection**. A model chooses the LLM/agent runtime. An AI profile chooses the complete repository-backed instruction package used by Brepia.

A package can provide versions of every instruction key declared in `config/ai/instructions/manifest.json`, including the primary Parametric and Creative prompts, tool descriptions, vision instructions, context injections, suggestions, transport instructions and provider-specific prompt material.

User-owned Custom Prompt Profiles remain a separate layer. They can still Overlay or Replace one instruction key after the repository package has selected its base template.

## Repository layout

- `config/ai/instructions/manifest.json` declares the stable instruction keys and legacy split-baseline template for each key.
- `config/ai/instructions/**/*.md` contains instruction template revisions. Nested directories are supported so future package revisions do not need to overwrite earlier templates.
- `config/ai/profiles/manifest.json` declares repository-backed packages and maps instruction keys to package-specific template revisions when a package differs from its baseline or parent.
- `config/ai/runtime.json` remains independent from package selection.

A package entry may define only the instruction keys that differ. Missing keys fall through an optional `extends` chain and finally to the frozen template declared by the instruction manifest.

## Initial profiles

### CADAM

`cadam` is the upstream-managed CADAM package. Its provenance is recorded in `lineage`. Future CADAM imports may advance this package without changing Brepia-managed profiles.

### Standard

`standard` is the Brepia-managed default. It records that it originated from the CADAM split revision, but it does **not** extend CADAM live. At the initial split both packages resolve to the same frozen instruction templates.

This isolation is intentional: a later CADAM sync must never silently change Standard.

## CADAM update rule

When new prompt material is imported from the CADAM project:

1. Add new versioned Markdown templates for only the instruction keys changed by CADAM. Do not overwrite a template still used as the Standard split baseline.
2. Update only the `cadam` package mappings and its lineage revision in `config/ai/profiles/manifest.json`.
3. Verify that `standard` resolves to exactly the same templates/content as before the sync.
4. Review useful CADAM changes separately before porting any of them into Standard. Brepia changes are deliberate, not inherited side effects.

## Brepia-derived profiles

Future Brepia profiles such as `qwen` may use `extends: "standard"` and override only the instruction keys for which evaluation demonstrates a useful difference. This keeps model-specific deltas small while improvements to Standard flow to profiles that intentionally inherit it.

A model is never selected by the profile manifest. The user can combine any compatible model with any available profile.

## Resolution order

For one instruction key, runtime resolution is:

1. selected repository-backed AI profile;
2. profile override for the instruction key;
3. inherited Brepia package override, when `extends` is configured;
4. frozen split-baseline template from `config/ai/instructions/manifest.json`;
5. optional user Custom Prompt Profile Overlay or Replace for that exact instruction key;
6. template variable rendering.

The package selection therefore affects the whole instruction system, while user customization remains backward compatible.

## Current checkpoint

The initial `cadam` and `standard` packages intentionally resolve to the same instruction content. No prompt optimization is part of this checkpoint. The next prompt-content phase can audit all instruction keys and introduce Standard revisions without changing the CADAM lineage.
