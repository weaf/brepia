# C2.5-A — per-step / provider usage observability

Date: 2026-09-10

Status: **repository-complete and CI-accepted; representative local runtime remeasurement still required before C2.5-B**.

This status note is subordinate to `docs/brep_c25_native_brep_agent_runtime_specialization_plan.md`. It records only the C2.5-A observability implementation and does not claim that the 12-step post-C2 runtime behavior has yet been classified.

## Repository checkpoint

Implementation checkpoint before this note:

`79cd7ac9e63f7335a07a869262e488ffe5b9a8a3` — `Fix accepted build step diagnostic name`

Repository gates on that checkpoint:

- Quality Gate #785 — PASS
  - dependency audit PASS
  - tests PASS: 129 files / 819 tests
  - typecheck PASS
  - lint PASS
  - build PASS
  - diff check PASS
- Grasshopper Build #357 — PASS
  - plugin build/package jobs PASS

PR #36 remains open, draft and stacked on `feature/brep-grasshopper-smart-component`. No merge boundary changed.

## What C2.5-A now measures

Normal AI SDK turns now emit bounded per-step diagnostics with:

- one-based step number;
- step duration;
- total elapsed generation time;
- active tool names and effective tool-choice policy;
- tool-call names;
- provider-facing model-message byte size;
- model-message growth from the previous step;
- accumulated `build_brep_project` tool-call/result payload byte size and growth;
- `build_brep_project` attempt count for the step;
- whether canonical `build_brep_project` execution accepted at least one candidate;
- bounded validation/tool error class and optional error code for rejected canonical builds;
- provider input/output/total token usage when supplied by the provider.

The diagnostics intentionally do **not** log prompts, project JSON, tool inputs/outputs, or error messages.

The final request-level `ai context actual usage` record now also reports:

- `providerUsageRequested`;
- `providerUsageAvailable`;
- token counts as `null` rather than misleading synthetic zeroes when usage is unavailable;
- total elapsed time;
- the one-based steps on which a canonical BRep candidate was accepted.

## Local OpenAI-compatible usage

The built-in local provider now constructs `@ai-sdk/openai-compatible` with:

```ts
includeUsage: true
```

This causes the compatible streaming request to ask the provider for usage information. It is intended for the llama.cpp/OpenAI-compatible path used by `local/...` models. Provider usage remains treated as optional evidence: Brepia reports availability explicitly instead of assuming that all compatible servers return it.

## Semantics deliberately unchanged

C2.5-A did not change:

- the Native BRep stop loop;
- retry eligibility after invalid builds;
- `answer_user` termination behavior;
- immutable revision persistence;
- canonical BRep validation;
- M1 canonical depth 12 or node limit 64;
- the finite/reference-free provider schema;
- provider expression depth 2;
- model-selection authority;
- OpenSCAD behavior;
- GHX return/import semantics.

In particular, the normal Native BRep path still uses the pre-C2.5 stop policy. That is intentional until the runtime evidence below resolves whether post-acceptance inference is redundant.

## Required representative runtime remeasurement

Repeat a representative Native BRep run with the same local model family used for the post-C2 evidence, preferably:

`local/qwen3.8-27b-mtp-128k`

Capture, in order, the `ai step started`, `ai step diagnostics`, and final `ai context actual usage` records for the turn.

The evidence must answer:

1. On which step was `build_brep_project` first called?
2. Was each build attempt accepted or rejected?
3. For rejected attempts, what bounded error class/code was reported?
4. On which step was the first canonical BRep candidate accepted?
5. Did any model steps run after that accepted candidate?
6. How much wall-clock time was spent before versus after first acceptance?
7. How did provider-facing message bytes and BRep tool payload bytes grow between steps?
8. Did the local provider return real input/output/total token usage after `includeUsage: true`?

Interpretation gate for C2.5-B:

- **validation/retry case:** if the early build attempts are rejected and the first accepted canonical build occurs only near the terminal step, retain retry semantics and do not classify the earlier steps as redundant;
- **post-acceptance case:** if a canonical `build_brep_project` is accepted early and later model steps continue, C2.5-B may make the first accepted canonical build terminal for the Native BRep CAD turn while preserving retries for invalid builds and immutable persistence;
- **mixed/uncertain case:** do not change stop behavior until the ambiguous steps are understood.

## Next phase boundary

C2.5-B is **not started** by this checkpoint because the required representative local runtime evidence is not available in repository CI.

After that evidence is captured and interpreted, continue in plan order:

C2.5-B (only if justified) → C2.5-C source-kind CAD prompt specialization → C2.5-D Rhino subtract parity only if technically justified and then host-verified.

No M2 work is started here.
