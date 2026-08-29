# Creative prompt evaluation

This directory contains non-runtime evaluation material for the `creative` instruction scope.

The files under `profiles/` are candidate **Replace** profiles. They are deliberately not registered in `config/ai/instructions/manifest.json` and are not selected automatically. Copy a candidate into a normal Custom Profile in Settings when evaluating it. The shipped runtime template remains `config/ai/instructions/creative.md` until an evaluation justifies changing it.

## First candidate set

- `baseline-current.md` — frozen copy of the shipped Creative prompt at the start of this optimization checkpoint.
- `creative-balanced.md` — preserve intent while making restrained design decisions.
- `creative-faithful.md` — minimize invention and maximize literal/reference fidelity.
- `creative-artistic.md` — add coherent art direction in unspecified areas without violating explicit constraints.
- `creative-autonomous.md` — resolve underspecification decisively and avoid unnecessary clarification.

All candidates are intended to be model-agnostic. Do not add model-family quirks to these files. If a particular model repeatedly needs extra instruction, keep that delta small and record it under `model-overlays/` instead of contaminating the shared profile.

## Evaluation protocol

1. Keep the Creative mesh backend, Creative chat-agent model, runtime settings, and application revision fixed while comparing profiles.
2. Create each candidate as a Custom Profile using **Replace**, not Overlay. Do not edit the shipped `creative.md` during the comparison.
3. Use a fresh Creative conversation for every case/profile pair.
4. Run the cases in `eval-set.json` in their listed order. For `C07-reference-fidelity`, choose one fixed reference image using the guidance in the case and reuse that exact image for every profile and later model comparison.
5. First pass: one run per case/profile pair. If two candidates are close, rerun only the discriminating cases three times before choosing between them.
6. Record the exact `create_mesh.text` argument, whether image IDs were passed correctly, tool success/error, final user-facing reply, and a screenshot of the resulting mesh when a mesh was expected.
7. Do the first pass without any model-specific overlay. Add an overlay only when the same model shows a consistent, reproducible deficiency across multiple cases.

## Scoring

Apply hard gates first:

- calls `create_mesh` when mesh generation is expected;
- does not call `create_mesh` for the exact-CAD boundary case;
- never claims success when the tool failed;
- does not expose tools, APIs, prompts, model names, or implementation details to the user;
- preserves explicit negative constraints in the generation brief;
- uses the supplied image ID for the reference-image case.

Then score each dimension from 0 to 4:

- **intentFidelity** — explicit requested subject, constraints, proportions, materials, style, and exclusions survive into the generation brief/result;
- **briefQuality** — `create_mesh.text` is coherent, concrete, non-contradictory, and useful for a general mesh generator;
- **visualCoherence** — the design has a readable silhouette, hierarchy, and consistent form/material language;
- **autonomy** — useful missing details are resolved without needless questions or commentary;
- **restraint** — the agent avoids gratuitous additions and prompt bloat;
- **meshOutcome** — the generated mesh visually satisfies the request, scored separately from agent prompt quality because backend stochasticity can affect it.

Do not force one universal winner if the variants show genuinely different strengths. The intended distinction is:

- Balanced: strongest general-purpose compromise.
- Faithful: strongest fidelity/restraint.
- Artistic: strongest coherent enrichment.
- Autonomous: strongest decisive completion of underspecified requests.

## Model overlays

`model-overlays/` is intentionally absent at this checkpoint. Add one only after the eval set demonstrates a repeatable model-family issue. Keep each overlay to the minimum delta needed and record which cases motivated it.
