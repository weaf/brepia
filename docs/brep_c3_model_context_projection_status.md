# C3 — BRep model-context projection

Status: **repository-complete, CI-accepted and runtime-accepted on a representative persisted Native BRep follow-up**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Runtime evidence: `docs/brep_c3_runtime_evidence_2026-09-10.md`

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

Successful revision summaries are normalized and bounded to 512 characters. They preserve useful revision intent but are never geometry authority.

## Current boundaries

C3 deliberately does **not**:

- truncate ordinary user conversation history;
- project or remove historical image/base64 content — C4 remains separate;
- itself enforce a hard model-aware token budget — C5 owns that boundary;
- add a rolling natural-language summary — C6 remains conditional on measurements;
- change the provider BRep schema;
- alter canonical BRep validation or persistence.

Creation turns are not projected by C3 because they have no persisted current BRep revision yet. OpenSCAD and Creative turns are unchanged.

## Pre-dispatch safety boundary

The projection is applied at the context-preflight boundary immediately before model dispatch and mutates the same `modelMessages` array later passed to `streamText(...)`.

C5 now makes this preflight fail-closed: if projection/context preparation fails, Brepia does not silently send the unprojected request.

A regression test locks the ordering:

```text
C3 projection/context preflight
-> C5 hard-budget derivation/assertion
-> streamText
```

## Diagnostics

`ai context diagnostics` exposes:

```text
brepModelProjection.branch
brepModelProjection.provider
```

Branch diagnostics include persisted BRep build/snapshot removal counts and bytes. Provider diagnostics include removed `build_brep_project` call/result counts, removed bytes and inserted compact revision summaries.

Existing C1 diagnostics continue to report complete persisted historical BRep payload sizes separately, so durable-history cost can be compared directly with the projected provider context.

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

The documentation checkpoint `139d8b61650e14dd88379495a1a675dfa42f51d2` also passed Quality Gate #828 and Grasshopper Build #400.

## Runtime acceptance

A real persisted Native BRep follow-up using:

```text
local/qwen3.8-27b-mtp-128k
```

verified:

```text
currentCanonicalBrep.present: true

branch projection:
  removedBuildToolParts:      1
  removedBrepSnapshotParts:   2
  summarizedAcceptedBuilds:   1
  removedBuildInputBytes:  5377
  removedSnapshotBytes:   10802

provider projection:
  removedToolCalls:            1
  removedToolResults:          1
  insertedRevisionSummaries:   1
  removedToolInputBytes:    5377
```

The first actual provider step contained no superseded BRep tool state:

```text
brepToolCallCount:    0
brepToolResultCount:  0
brepToolInputBytes:   0
brepToolOutputBytes:  0
brepToolPayloadBytes: 0
```

The current canonical source remained available and the build was accepted on the first step:

```text
stepCount:              1
acceptedBrepBuildSteps: [1]
elapsed:                167207 ms
provider input:         83612 tokens
provider output:         2744 tokens
provider total:         86356 tokens
```

This closes the C3 runtime acceptance boundary. The same run also exposed the estimator/output-reservation evidence that triggered C5; see `docs/brep_c3_runtime_evidence_2026-09-10.md` and `docs/brep_c5_hard_context_budget_status.md`.

## C4 decision from C3 evidence

The accepted C3 follow-up contained:

```text
images.count:           0
images.base64Chars:     0
images.estimatedTokens: 0
```

There is therefore no evidence that historical images are the next bottleneck on this Native BRep path. C4 remains planned but deferred until an image-bearing fixture demonstrates material historical image cost.

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
