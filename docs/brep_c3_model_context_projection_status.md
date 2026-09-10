# C3 — BRep model-context projection

Status: **repository-complete and CI-accepted; representative real follow-up remeasurement pending**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Purpose

C3 separates durable Native BRep conversation history from the bounded provider working context used for a follow-up turn.

The persisted database/message tree remains complete and authoritative for:

- UI/history;
- active branch and leaf semantics;
- immutable revision lineage;
- active canonical BRep source resolution.

The model does not need every superseded complete BRep project again once the current canonical project has been resolved.

## Implemented projection

For a persisted Native BRep follow-up turn:

1. resolve the active canonical BRep from the full durable branch as before;
2. inject that current canonical project exactly once through the existing BRep system context;
3. convert the durable branch to provider model messages using the existing AI SDK path;
4. before `streamText(...)`, remove historical `build_brep_project` tool-call inputs and matching tool-result payloads from the actual provider message array;
5. replace successful historical BRep build results with a bounded server-derived revision summary when one is available;
6. leave user messages and current user intent intact;
7. leave durable DB/UI history untouched.

Historical `data-brep-project` parts remain persisted but are excluded from the branch projection because current canonical geometry already has its dedicated authoritative system-context copy.

Successful revision summaries are normalized and bounded to 512 characters. They can preserve useful intent such as a prior accepted edit, but they are never geometry authority.

## Current boundaries

C3 deliberately does **not** yet:

- truncate ordinary user conversation history;
- project or remove historical image/base64 content — that belongs to C4;
- enforce a hard model-aware token budget — that belongs to C5;
- add a rolling natural-language summary — that remains C6 only if measurements justify it;
- change the provider BRep schema;
- alter canonical BRep validation or persistence.

Creation turns are not projected by C3 because they have no persisted current BRep revision yet. OpenSCAD and Creative turns are unchanged.

## Pre-dispatch safety boundary

The projection is applied at the existing context-diagnostics boundary immediately before `streamText(...)` and mutates the same `modelMessages` array later passed to model dispatch.

A regression test locks this ordering so a future refactor cannot move that boundary after `streamText(...)` without failing CI.

## Diagnostics

`ai context diagnostics` now includes:

```text
brepModelProjection.branch
brepModelProjection.provider
```

Branch diagnostics include:

- input/output message counts;
- removed historical BRep build parts;
- removed persisted BRep snapshot parts;
- bounded successful summaries retained;
- removed BRep build input/output byte counts;
- removed snapshot byte count.

Provider diagnostics include:

- removed provider `build_brep_project` tool-call count;
- removed provider tool-result count;
- inserted revision-summary count;
- removed tool input/output byte counts;
- resulting provider message count.

Existing C1 diagnostics still report the complete persisted historical BRep payload sizes separately. This makes the durable-history cost and the actual projected provider-message cost directly comparable.

## Repository acceptance

Main C3 checkpoints:

```text
eb7e90da7d899cf8a87016dedc266a251df0a737  Project Native BRep history for model context
06ac6f1ea8621fe403ca31eda2003905757ab8b7  Project provider BRep history before dispatch
23301e05b28212505b995da351bc2d7edc66b13b  Apply C3 BRep model context projection
27442632eacdea4ba43ca5c9e1eba5080ffbd481  Verify C3 pre-dispatch context projection
1231eceee6cd48683a02a7fdc15bb025c1069b44  Lock C3 projection before model dispatch
```

CI on `1231eceee6cd48683a02a7fdc15bb025c1069b44`:

```text
Quality Gate #826       PASS
Grasshopper Build #398 PASS
```

The Quality Gate covers the new projection behavior plus the existing repository regression suite, typecheck, lint, build and diff check.

## Required real runtime remeasurement

C3 changes **follow-up** history, so the next representative measurement must not be another first-turn creation fixture.

Use an existing persisted Native BRep conversation and perform one small, unambiguous edit with:

```text
local/qwen3.8-27b-mtp-128k
```

For example, change one existing published dimension while leaving the rest of the model unchanged.

Capture:

```text
ai context diagnostics
ai step started
ai step diagnostics
ai context actual usage
```

Specifically verify:

1. `currentCanonicalBrep.present = true`;
2. `brepModelProjection.branch.removedBuildToolParts > 0` for a branch containing earlier AI BRep revisions;
3. `brepModelProjection.provider.removedToolCalls > 0` and matching tool results are removed where present;
4. the first provider step does not contain superseded historical BRep tool payloads;
5. the current canonical project remains available to the model and the requested edit is semantically correct;
6. accepted canonical build still terminates the normal Native BRep turn through C2.5-B;
7. provider-reported input/output/total token usage is captured for comparison.

## Baseline for comparison

The accepted post-C2.5 first-turn fixture reported:

```text
static estimated input: 36,419 tokens
provider input:         56,413 tokens
provider output:        25,674 tokens
provider total:         82,087 tokens
stepCount:              1
elapsed:                about 10m33s
```

That fixture had no prior BRep history, so C3 is not expected to materially change those first-turn numbers. The value of C3 must be measured on a persisted follow-up where superseded BRep tool/project payloads would otherwise accumulate.

## Acceptance boundary

Until the real follow-up measurement succeeds, C3 is **repository-complete / CI-accepted**, not runtime-accepted.

If the follow-up behaves correctly and the diagnostics prove that historical full-project payloads were removed, continue to the planned remeasurement decision before C4. Do not start M2 as part of C3.

## Preserved architecture

C3 does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` authority;
- immutable revisions and branch/leaf persistence;
- build123d/OCCT native geometry authority;
- M0/M1 integrity;
- canonical scalar-expression depth 12 or node limit 64;
- provider expression depth 2 or finite/reference-free provider schema;
- Settings/discovery model authority;
- GHX parameter-only import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD behavior;
- PR #36 draft/stacked/unmerged state;
- M2 status.
