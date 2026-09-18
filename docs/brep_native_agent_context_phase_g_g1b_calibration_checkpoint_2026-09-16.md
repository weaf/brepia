# Native BRep Phase G G1b calibration checkpoint — 2026-09-16

Status: **implementation checkpoint pending CI**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Selected phase: **Phase G — context-growth measurement**

## Purpose

This checkpoint calibrates the existing G1 diagnostics before the representative G2 OpenCode Streaming stress run. It does not start Phase H compaction and does not change canonical BRep schema/runtime semantics.

The pre-checkpoint CLI observation exposed two measurement mismatches:

1. `resolveAiModelBudgetMetadata()` only recognized `local/<model>`, so OpenCode models backed by the same configured local llama-swap runtime did not reuse saved context/output metadata.
2. The C1 conservative input estimate includes AI SDK provider tool schemas even though the OpenCode CLI/Streaming adapters do not forward those schemas as provider tools. That conservative total remains correct for the established C5 safety gate, but G2 needs a separate schema-free baseline for calibration.

## G1b changes

### Local metadata alias resolution

A pure helper maps only these explicit local-runtime identities to the persisted local-model metadata key:

```text
local/<model>
agent/opencode/llama-swap/<model>
opencode/llama-swap/<model>
```

Other provider/model identities do not borrow local metadata.

No context or output limit is inferred from model names such as `-128k`. If the mapped local metadata row does not exist, budget metadata remains `source: 'unknown'` with null limits.

### Schema-free diagnostic baseline

`AiContextDiagnostics.total` now exposes both:

```text
estimatedInputTokens
estimatedInputTokensExcludingProviderToolSchemas
```

The existing `estimatedInputTokens` remains unchanged and continues to include:

```text
system/instructions + provider tool schemas + effective model messages
```

The new calibration value is:

```text
system/instructions + effective model messages
```

This permits G2 to compare the conservative Brepia envelope with the schema-free baseline used by OpenCode transports without weakening the established C5 hard-budget gate.

## Preserved boundaries

This checkpoint does not change:

- canonical `BrepProject` authority;
- `schemaVersion: 1`;
- canonical geometry operations;
- exactly-one-solid semantics;
- graph/integrity validation;
- build123d/OCCT authority;
- immutable revision semantics;
- Phase E repair limits;
- provider tool routing;
- C5 hard-budget enforcement or its conservative total;
- compaction/history projection behavior.

PR #36 remains open, draft, stacked on `feature/brep-grasshopper-smart-component`, and unmerged.

## Next empirical gate

After this checkpoint is CI-green, run a representative **OpenCode Streaming** Native BRep stress fixture for G2 and capture:

- `ai context diagnostics`;
- `ai step started`;
- `ai step diagnostics`;
- `ai context actual usage`;
- durable model-step / repair / build-attempt telemetry.

Classify context growth from consecutive deltas rather than absolute prompt size alone.

OpenCode external-session token usage is measured only when `step.ended.tokens` reports it. Missing external usage remains **unavailable**, never synthetic zero.
