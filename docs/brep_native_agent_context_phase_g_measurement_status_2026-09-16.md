# Native BRep Phase G context-growth measurement status — 2026-09-16

Status: **G1 repository instrumentation complete and CI-accepted; G2 empirical classification pending a representative long OpenCode run**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Selected plan: `docs/brep_native_agent_context_stress_plan_2026-09-15.md`

## Scope

Phase G measures Native BRep working-context growth before any compaction decision.

No compaction, rolling summary, history truncation or new canonical geometry capability is introduced by this checkpoint.

## Reconciliation

Phase G does not start from an empty observability stack. The current branch already has four relevant accepted layers:

1. **C1 request decomposition** in `src/server/aiContextDiagnostics.ts`:
   - system/instruction bytes and deterministic token estimate;
   - provider tool-schema bytes/tokens and per-tool breakdown;
   - current canonical BRep bytes/tokens;
   - persisted ordinary history;
   - historical BRep tool/snapshot payloads;
   - effective provider model-message bytes/tokens;
   - image/base64 cost;
   - model budget/headroom metadata.
2. **C2.5-A per-step observability** in `src/server/aiStepDiagnostics.ts` + `src/server/aiChat.ts`:
   - provider-facing message size per step;
   - step-to-step message growth;
   - BRep tool payload size/growth;
   - build attempt/outcome diagnostics;
   - provider input/output/total usage when reported.
3. **C5 hard budget** in `src/server/aiContextBudget.ts`:
   - conservative input bound;
   - hard input limit/headroom;
   - effective per-step output cap.
4. **C3/C6 projection evidence**:
   - superseded structured BRep state and superseded accepted-build reasoning are already removed from provider working memory while durable history remains intact.

Phase F additionally provides durable monotonic `model_step` and `transport_repair` counters, so cumulative step/repair progress does not need a second counter system.

## G1 additions

Checkpoint:

```text
10245c0e8fe29671c27e186ae902561ddbebe186
Extend Native BRep per-step context growth measurements
```

CI on the exact checkpoint:

- Quality Gate #1164 — PASS
- Grasshopper Build #736 — PASS

`AiStepContextMeasurement` now includes bounded numeric metadata for:

- total provider-facing model-message bytes;
- deterministic model-message token estimate;
- image count/base64 characters/image token estimate;
- all tool-result count/output bytes/token estimate;
- BRep build tool-call/result count;
- BRep tool input bytes/token estimate;
- BRep tool output bytes/token estimate;
- combined BRep tool payload bytes/token estimate.

The existing `ai step started` record automatically receives these fields because it already spreads the complete step measurement and adds step-to-step `modelMessageGrowthBytes` plus `brepToolPayloadGrowthBytes`.

No prompt, model message, project JSON, tool input/output or hidden reasoning is returned by the measurement object.

## Phase G measurement matrix

The current instrumentation can reconstruct the required G1 evidence as follows.

| Required measurement | Current authority |
| --- | --- |
| Total model-message bytes/tokens | `AiStepContextMeasurement.modelMessageBytes` + `modelMessageEstimatedTokens` |
| System/instruction budget | C1 `systemInstructions` |
| Tool-schema budget | C1 `providerToolSchemas`, including per-tool breakdown; combine with per-step `activeTools` when a reduced active-tool set is used |
| Current BRep project payload | C1 `currentCanonicalBrep` |
| BRep tool payload growth | per-step BRep input/output/payload fields + existing `brepToolPayloadGrowthBytes` |
| General tool-result payload growth | per-step `toolResultOutputBytes` / `toolResultOutputEstimatedTokens`; compare consecutive step records |
| Images/base64 | per-step image fields plus C1 image decomposition |
| Provider usage | `onStepFinish` input/output/total usage with explicit availability flag |
| External OpenCode session usage | Streaming OpenCode maps `step.ended.tokens` to AI SDK usage when the OpenCode runtime reports it |
| Cumulative model steps | durable Phase F `model_step` sequence/number |
| Cumulative transport repairs | durable Phase F `transport_repair.repairCount` |
| Server BRep build attempts | durable Phase F build attempt/outcome events + existing per-step build diagnostics |
| Hard context headroom | C5 request/per-step hard-budget diagnostics |

## External-session usage boundary

OpenCode Streaming currently maps real OpenCode `step.ended` token data into provider usage. When those tokens are present they are valid evidence for external-session cost.

CLI agent adapters still expose the compatibility zero-usage structure when their CLI output does not provide token accounting. Those zeroes must **not** be interpreted as measured zero context cost. `aiChat.ts` already treats provider usage as available only when at least one token count is positive.

Therefore G2 must report external-session usage as one of:

```text
reported: <numeric usage>
unavailable: runtime did not report token usage
```

It must never convert `unavailable` into a synthetic zero-cost claim.

The selected OpenCode/Codex BRep transport instruction is also a separate fixed transport input, not canonical geometry state. The exact selected bundled instruction must be recorded with the runtime fixture if transport-instruction overhead becomes a candidate dominant class. Current C1 `systemInstructions` describes Brepia's provider system prompt and must not be mislabeled as including external transport/session history.

## G2 evidence gate

Do **not** choose a compaction strategy from the historical C6 result alone. C6 proved that superseded accepted-build reasoning dominated an earlier direct-provider fixture and that the deterministic C6 projection removed it. It does not prove the dominant growth source of a long persistent OpenCode session after Phases E/F.

A representative G2 run must capture consecutive steps/repairs from one Native BRep generation and compare at least:

```text
step N
  modelMessageBytes / modelMessageEstimatedTokens
  modelMessageGrowthBytes
  toolResultOutputBytes / estimated tokens
  brepToolPayloadBytes / estimated tokens
  brepToolPayloadGrowthBytes
  activeTools
  provider/OpenCode input/output/total usage when available
  hard-budget headroom
  durable modelStepNumber
  durable repairCount / buildAttemptNumber
```

Together with the request-static C1 categories:

```text
systemInstructions
providerToolSchemas
currentCanonicalBrep
brepModelProjection
```

The evidence must then classify the dominant current growth source as one or more of:

- repeated canonical BRep state;
- repeated tool diagnostics/results;
- conversation prose/reasoning;
- transport instruction overhead;
- persistent external OpenCode session history;
- images;
- another explicitly measured duplicated-state class.

If provider/OpenCode token usage is unavailable, G2 may still classify Brepia-side growth from deterministic bytes/tokens, but it must leave external-session growth **unknown** rather than guessing.

## Current phase boundary

G1 repository instrumentation is complete and CI-accepted.

G2 is intentionally **not closed** by this checkpoint because no new representative post-Phase-F long OpenCode runtime measurement has yet been captured. This is the next empirical gate before Phase H.

Do not start Phase H compaction until that evidence identifies the current dominant growth class.

All permanent canonical/runtime/PR boundaries remain unchanged. PR #36 remains open, draft, stacked on `feature/brep-grasshopper-smart-component`, and unmerged.
