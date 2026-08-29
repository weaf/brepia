# Standard Parametric prompt evaluation

This directory contains evaluation source material for the Brepia-owned `standard` Parametric instruction set. The permanent repository-backed `test` AI profile is the runtime laboratory slot used to evaluate candidates without changing CADAM or Standard.

## Goal

Evaluate Brepia-owned Parametric instruction candidates against the frozen CADAM split while keeping model selection, runtime settings, tool schemas, transport and application revision constant.

Baseline:

- repository package `cadam`, instruction key `parametric` from `cadam-split-2026-08-29`.

## Standard v1 — REJECTED 2026-08-29

Candidate source retained for evaluation history:

- `candidates/standard-v1-parametric.md`
- `candidates/standard-v1-context-parametric-attachment.md`

Observed A/B runs used the same model and prompts for:

1. creation of an exact-dimension L-shaped mounting bracket;
2. a constrained follow-up edit that moved only the two mounting holes while preserving all other geometry and dimensions.

Both CADAM and Standard v1 produced effectively the same requested geometry and the same follow-up edit. Standard v1 did not demonstrate a measurable improvement. CADAM additionally exposed the hole Z offset as an editable parameter in the initial result and selected a more convenient model origin for interactive rotation.

Decision:

- do not promote Standard v1 into `standard.instructions`;
- CADAM remains the stronger observed baseline for these tests;
- further testing of Standard v1 is not required unless a specific scenario is identified where the candidate is expected to provide a different capability or behavior;
- the candidate files remain in this directory as evaluation history only;
- the runtime `test` profile is reset to inherit Standard with no active overrides until the next experiment is deliberately loaded.

## Runtime evaluation slot

- repository package `test`
- `test` extends `standard`
- when idle, `test.instructions` is empty and resolves identically to Standard
- a future experiment should override only the instruction keys under test
- after an experiment is promoted or rejected, reset Test to the idle state
- `test` may be selected as a user's temporary default during experiments, but `defaultProfile` in the repository manifest remains `standard`

## Controlled protocol for future candidates

1. Define a concrete hypothesis for what the candidate is expected to improve before loading it into Test.
2. Use the same Parametric model, runtime settings and application revision for every comparison.
3. Run each creation case in a fresh conversation unless the experiment specifically targets edit/continuation behavior.
4. Run the baseline with AI profile **CADAM** and the candidate with AI profile **Test**. Do not add a Custom Prompt Profile during the comparison.
5. Record build calls, compile status, iteration count, final artifact, final reply and visual QA result.
6. Do not introduce a model-family overlay unless the experiment is explicitly measuring a model-specific deficiency.

## Hard gates

A candidate fails a case if it:

- changes an explicit exact dimension without user permission;
- claims creation/update/fix without a successful CAD build in that turn;
- returns a partial or markdown-fenced artifact where a complete raw OpenSCAD artifact is required;
- ignores compiler/validation failure;
- finalizes while the supplied inspection clearly shows a missing required feature;
- recreates an attached STL instead of using `import()`;
- imposes a fixed attachment rotation without evidence;
- exposes internal tool/prompt/protocol details to the user.

## Scoring

Score 0-4 for:

- `constraintFidelity`
- `artifactCorrectness`
- `visualTaskCompletion`
- `editPreservation`
- `parameterQuality`
- `iterationEfficiency`
- `responseDiscipline`

Compile success and hard-gate failures are recorded separately. Promotion requires no regression on hard gates and a clear aggregate improvement over CADAM on the same model/runtime.

## Promotion

After a winner is established, copy only the measured improvements from the Test slot into Brepia-owned Standard runtime instruction files and point only `standard.instructions` at them. Never edit the frozen CADAM revision. Then reset Test so it is ready for the next experiment.
