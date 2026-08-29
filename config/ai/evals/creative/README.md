# Creative prompt evaluation

This directory contains non-runtime evaluation material for the `creative` instruction key. Nothing here is loaded by the application and no candidate is registered in `config/ai/profiles/manifest.json`.

## Goal

Choose the first Brepia-owned Creative prompt for the `standard` instruction package without changing the upstream-managed `cadam` profile.

The first pass deliberately changes only the `creative` system prompt. `tool.create_mesh`, Creative context templates, runtime settings, mesh backend selection and provider behavior stay fixed so the comparison measures prompt behavior rather than architecture.

## Candidates

- `baseline-cadam-split` — frozen current behavior from `cadam-split-2026-08-29`.
- `creative-balanced` — general-purpose balance of fidelity, useful completion and restraint.
- `creative-faithful` — strongest literal/reference fidelity and lowest unsolicited invention.
- `creative-artistic` — stronger coherent visual interpretation in unspecified areas.
- `creative-autonomous` — resolves ordinary ambiguity decisively and minimizes routine clarification.

These are prompt candidates, not repository package IDs. During evaluation, create temporary Custom Prompt Profiles for scope `creative` using **Replace**, not Overlay. Keep the selected repository package on `standard`.

## Controlled protocol

1. Complete the package-profile regression gate in `docs/ai_instruction_profiles_plan.md` first.
2. Hold the Creative chat-agent model, TRELLIS.2 mesh backend, runtime settings and application revision constant across all candidates.
3. Create one temporary `creative` Custom Prompt Profile per candidate using Replace.
4. Start a fresh Creative conversation for every case/candidate run. Do not reuse conversation history across candidates.
5. Run `eval-set.json` in order. Case C07 uses one fixed reference image reused across every profile and later model comparison.
6. First pass: one run per case/candidate. If two candidates are close, repeat only the discriminating cases three times each.
7. Record the exact `create_mesh.text`, image IDs, whether the tool was called, tool status, final user-facing reply and a screenshot/inspection note for the resulting mesh.
8. Do not add model-family overlays during the first pass. A model-specific overlay is justified only by a repeatable deficiency on the same eval cases.

## Hard gates

A candidate is disqualified for a case if it:

- fails to call `create_mesh` when a Creative mesh is requested;
- calls `create_mesh` for the exact-CAD boundary case instead of redirecting to CAD;
- drops or reverses a material negative constraint;
- claims success when mesh generation failed;
- exposes tools, APIs, prompts, model names or implementation details to the user;
- uses the wrong supplied reference-image ID.

## Scoring

Score each dimension from 0 to 4. Keep `meshOutcome` separate because mesh generation is stochastic and should not be confused with prompt quality.

- `intentFidelity` — preserves subject, required parts, exclusions, proportions, materials, colors and reference features.
- `briefQuality` — produces a concrete, compact and actionable `create_mesh.text` brief.
- `visualCoherence` — additions reinforce one readable design language rather than unrelated detail.
- `autonomy` — resolves ordinary missing details without unnecessary questions.
- `restraint` — avoids prompt bloat and unsolicited motifs/accessories.
- `meshOutcome` — resulting geometry/appearance matches the requested design, scored separately.

Recommended prompt score is the mean of the first five dimensions after hard-gate failures are excluded. Use `meshOutcome` as secondary evidence and repeat a case when backend stochasticity appears to dominate.

## Promotion rule

After a winner is selected, copy its prompt into a Brepia-owned runtime file (for example `config/ai/instructions/profiles/standard/creative.md`) and set only `standard.instructions.creative` to that file in `config/ai/profiles/manifest.json`.

Do not edit the `cadam-split-2026-08-29` revision and do not point `cadam` at the Brepia file. This promotes one measured Standard delta while preserving the CADAM upstream lineage.
