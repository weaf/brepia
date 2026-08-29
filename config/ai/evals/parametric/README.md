# Standard Parametric prompt evaluation

This directory contains evaluation source material for the Brepia-owned `standard` Parametric instruction set. The current candidate is mirrored into the repository-backed `test` AI profile so it can be selected directly in the app without changing CADAM or Standard.

## Goal

Compare the frozen CADAM split against the first concise Brepia Standard Parametric candidate while keeping model selection, runtime settings, tool schemas, transport and application revision constant.

Baseline:

- repository package `cadam`, instruction key `parametric` from `cadam-split-2026-08-29`.

Candidate source:

- `candidates/standard-v1-parametric.md`
- `candidates/standard-v1-context-parametric-attachment.md`

Runtime evaluation slot:

- repository package `test`
- `test` extends `standard`
- its current `parametric` and `context.parametric_attachment` overrides mirror the Standard v1 candidate
- all other instruction keys inherit from Standard
- `test` is a permanent laboratory slot; it may be selected as a user's temporary default during experiments, but `defaultProfile` in the repository manifest remains `standard`

## Controlled protocol

1. Complete the package-profile functional smoke first.
2. Use the same Parametric model, runtime settings and application revision for every comparison.
3. Run each case in a fresh conversation.
4. Run the baseline with AI profile **CADAM** and the candidate with AI profile **Test**. Do not add a Custom Prompt Profile during the comparison.
5. Record build calls, compile status, iteration count, final artifact, final reply and visual QA result.
6. Do not introduce a Qwen/model-family overlay in this pass. First determine whether Standard itself is an improvement.

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

After a winner is established, copy the measured prompt/context from the Test slot into Brepia-owned Standard runtime instruction files and point only `standard.instructions` at them. Never edit the frozen CADAM revision. The Test slot remains available for the next experiment.
