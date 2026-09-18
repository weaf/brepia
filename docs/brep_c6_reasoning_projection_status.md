# C6 — superseded BRep reasoning projection

Status: **complete, CI-accepted and runtime-accepted**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Detailed runtime evidence:

```text
docs/brep_c6_runtime_evidence_2026-09-10.md
```

## Why C6 started

C5 runtime acceptance succeeded, but the same persisted Native BRep follow-up showed that the conservative hard-budget headroom had fallen to only `1123` tokens:

```text
rawEstimatedInputTokens:       60213
conservativeInputTokens:      105373
hardInputLimitTokens:         106496
hardInputHeadroomTokens:        1123
ordinaryConversationHistory:   81114 bytes
images.count:                      0
```

C3 had already removed superseded complete BRep tool inputs/results and persisted BRep snapshots. Inspection of the remaining projection showed that assistant `reasoning` emitted in the same historical turn as an accepted `build_brep_project` was still retained in provider working context.

That reasoning is not user intent, canonical geometry authority, or required revision lineage because the exact current canonical project is supplied separately and bounded accepted-build summaries remain.

## Implemented projection

For persisted Native BRep follow-up turns only, the BRep model-context projection removes historical assistant `reasoning` parts when they are attached to a message containing `tool-build_brep_project`.

The provider-side safety projection independently removes matching `reasoning` content from an assistant provider message that contains a `build_brep_project` tool call.

The following remain unchanged and available to the model:

- all user messages, including the current leaf;
- unrelated assistant messages/reasoning that are not attached to a superseded BRep build;
- bounded server-derived accepted-revision summaries;
- the exact current canonical BRep through the authoritative system context.

Durable DB/UI history remains untouched.

## Diagnostics

C3/C6 projection diagnostics report:

```text
brepModelProjection.branch.removedBuildReasoningParts
brepModelProjection.branch.removedBuildReasoningBytes
brepModelProjection.provider.removedBuildReasoningParts
brepModelProjection.provider.removedBuildReasoningBytes
```

These are numeric-only bounded diagnostics. No reasoning text is logged.

## Repository acceptance

Implementation checkpoints:

```text
2237e1e3b79e27433c6213680ea17c3252005cb6  Drop superseded BRep assistant reasoning from model context
d0130dd220d3cd10e3c6b7c05c3e4cb3c173653e  Test superseded BRep reasoning projection
```

CI on `d0130dd220d3cd10e3c6b7c05c3e4cb3c173653e`:

```text
Quality Gate #838       PASS
Grasshopper Build #410 PASS
```

Documentation checkpoint `d9e5dc337c65cd4578ff86a5040a1aa265dc5869` also passed:

```text
Quality Gate #842       PASS
Grasshopper Build #414 PASS
```

## Runtime acceptance

A third small follow-up was run in the same persisted Native BRep conversation with:

```text
local/qwen3.8-27b-mtp-128k
```

C6 directly removed historical superseded-build reasoning:

```text
branch removed build reasoning parts:    3
branch removed build reasoning bytes: 83981
provider removed build reasoning parts:  3
provider removed build reasoning bytes:83981
```

Durable ordinary conversation history was still present and had grown from the C5 fixture:

```text
81114 -> 84356 bytes
```

But the actual projected provider messages fell from:

```text
83312 -> 1000 bytes
```

That is a reduction of `82312` bytes, or about `98.8%`.

C5 headroom recovered correspondingly:

```text
raw estimate:        60213 -> 39635
conservative input: 105373 -> 69362
hard headroom:        1123 -> 37134
effective max output:17507 -> 53518
```

The first provider step remained free of historical BRep payloads:

```text
brepToolCallCount:   0
brepToolResultCount: 0
```

The current canonical BRep remained present:

```text
currentCanonicalBrep.present: true
currentCanonicalBrep.bytes:   5295
```

Provider usage and terminal-build behavior remained healthy:

```text
provider input:       60212
provider output:       4210
provider total:       64422
stepCount:                1
accepted build step:      1
elapsed:             154741 ms
```

The provider/static ratio was `1.5192`, still below the conservative C5 multiplier `1.75`.

## Acceptance conclusion

C6 is runtime-accepted. The measurement directly proves that superseded assistant build reasoning was the dominant removable conversational cost in the representative Native BRep path.

The deterministic projection restores substantial hard-budget headroom without truncating user-authored history, changing durable DB/UI history, or weakening canonical BRep authority.

Therefore **do not add an AI-generated rolling summary** for this evidence set.

Only reconsider broader summary/truncation if future measurements show that older user-authored natural-language history itself becomes a material context cost.

C4 remains deferred until image-bearing evidence exists.

M2 remains unstarted until the context/runtime track is explicitly transitioned to the modeling roadmap. PR #36 remains draft/stacked/unmerged.

## Preserved architecture

C6 does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` authority;
- immutable revisions and branch/leaf persistence;
- build123d/OCCT native geometry authority;
- M0/M1 validation;
- canonical scalar-expression depth 12 or node limit 64;
- provider expression depth 2 or finite/reference-free provider schema;
- Settings/discovery model authority;
- GHX parameter-only import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD semantics.
