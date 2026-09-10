# C6 — superseded BRep reasoning projection

Status: **repository-complete and CI-accepted; representative runtime remeasurement pending**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

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

The preceding C3 runtime fixture had:

```text
raw estimated input: 59628
conservative input: 104349
hard headroom:        2147
```

One additional similarly sized follow-up would therefore likely hit the conservative C5 gate.

C3 had already removed superseded complete BRep tool inputs/results and persisted BRep snapshots. Inspection of the remaining projection showed that assistant `reasoning` emitted in the same historical turn as an accepted `build_brep_project` was still retained in provider working context.

That reasoning is:

- not user intent;
- not canonical geometry authority;
- not required to reconstruct the current BRep because the exact current canonical project is supplied separately;
- not required for revision lineage because bounded accepted-build summaries already remain.

## Implemented projection

For persisted Native BRep follow-up turns only, the existing BRep model-context projection now removes historical assistant `reasoning` parts when they are attached to a message containing `tool-build_brep_project`.

The provider-side safety projection independently removes matching `reasoning` content from an assistant provider message that contains a `build_brep_project` tool call.

This is intentionally narrower than a generated rolling conversation summary.

The following remain unchanged and available to the model:

- all user messages, including the current leaf;
- unrelated assistant messages/reasoning that are not attached to a superseded BRep build;
- bounded server-derived accepted-revision summaries;
- the exact current canonical BRep through the existing authoritative system context.

Durable DB/UI history remains untouched.

## Diagnostics

C3/C6 projection diagnostics now additionally report:

```text
brepModelProjection.branch.removedBuildReasoningParts
brepModelProjection.branch.removedBuildReasoningBytes
brepModelProjection.provider.removedBuildReasoningParts
brepModelProjection.provider.removedBuildReasoningBytes
```

These are numeric-only bounded diagnostics. No reasoning text is logged.

The next runtime measurement can therefore prove directly whether the ~81 kB ordinary-history cost was dominated by superseded BRep reasoning rather than relying on inference from aggregate history size.

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

Quality Gate includes the new projection regressions plus the full repository suite, typecheck, lint, build and diff check.

## Required runtime remeasurement

Use the same persisted Native BRep conversation and model:

```text
local/qwen3.8-27b-mtp-128k
```

Perform one more small unambiguous follow-up edit and capture:

```text
ai context diagnostics
ai step started
ai step diagnostics
ai context actual usage
```

Verify specifically:

1. `removedBuildReasoningParts > 0` and `removedBuildReasoningBytes > 0` if the persisted accepted BRep turns contain historical reasoning;
2. effective provider message bytes/static input fall materially if that reasoning was the dominant cost;
3. C5 remains `enforced: true` and `fits: true` with materially restored hard headroom;
4. historical BRep tool calls/results remain absent from the first provider step;
5. the current canonical BRep and current user intent remain correct;
6. the accepted build still terminates at step 1 through C2.5-B;
7. real provider token usage remains within the selected model context.

## Decision after remeasurement

If the runtime measurement shows that superseded build reasoning accounts for the dominant removable ordinary-history cost and restores healthy headroom, do **not** add an AI-generated rolling summary merely because C6 originally carried that name in the roadmap. Keep the deterministic projection as the sufficient solution.

Only consider a broader bounded summary/truncation mechanism if, after reasoning projection, older user-authored natural-language history itself becomes a material budget cost.

C4 remains deferred until image-bearing evidence exists.

M2 remains unstarted and PR #36 remains draft/stacked/unmerged.

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
