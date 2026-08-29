# Creative prompt optimization checkpoint

## Status

Prepared, not yet executed.

The repository package-profile extension is implemented, but its fresh local NOx/Supabase regression gate must be completed before any candidate is promoted into the runtime `standard` profile.

## Scope

This phase evaluates the `creative` system prompt only. It does not change:

- CADAM instruction content or lineage;
- Creative mesh backend selection;
- TRELLIS.2 behavior;
- Creative chat-agent model selection/fallback;
- model/provider configuration;
- `tool.create_mesh` protocol and backend-failure semantics;
- runtime limits;
- optional `falMesh.ts` provider refactor.

Evaluation assets live in `config/ai/evals/creative/` and are intentionally outside runtime loading.

## Candidate set

1. `baseline-cadam-split`
2. `creative-balanced`
3. `creative-faithful`
4. `creative-artistic`
5. `creative-autonomous`

All four Brepia candidates are model-agnostic. Model-family overlays are deferred until repeated eval evidence demonstrates a specific deficiency.

## Evaluation sequence

1. Finish the package-profile extension gate in `docs/ai_instruction_profiles_plan.md`.
2. Hold agent model, TRELLIS.2 backend, runtime settings and app revision constant.
3. Run C01-C07 once for all five candidates using temporary Custom Prompt Profiles in Replace mode.
4. Score prompt behavior separately from stochastic mesh outcome using the rubric in `config/ai/evals/creative/README.md`.
5. Repeat the most discriminating cases three times when candidates are close.
6. Select a winner or synthesize a narrowly justified revision from the observed strengths/weaknesses.
7. Promote the winner only to Brepia Standard, preferably as a single `standard.instructions.creative` override. Do not edit the frozen CADAM split revision.
8. Re-run the technical gate plus a focused Creative smoke test after promotion.

## Promotion acceptance criteria

The promoted Standard Creative prompt must:

- pass every hard gate in the eval protocol;
- outperform or tie the baseline on explicit-constraint fidelity;
- improve at least one of brief quality, autonomy or visual coherence without materially reducing restraint;
- retain the exact-CAD redirect boundary;
- remain model-agnostic and provider-agnostic;
- require no changes to tool schemas, backend routing or model selection.

## Next phase

After Creative Standard is selected and verified, apply the same controlled method to Generative/Parametric. Generative evaluation should be designed around its larger instruction surface rather than copying the Creative cases mechanically.
