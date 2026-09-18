# Native BRep Phase F agent telemetry closeout — 2026-09-16

Status: **repository-complete and CI-accepted**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

Phase F closes the agent-telemetry and verbose conversation-progress slice selected by `docs/brep_native_agent_context_stress_plan_2026-09-15.md`.

This phase changes observability and durable UI state only. It does not add or relax any canonical BRep geometry capability, does not change `schemaVersion: 1`, and does not weaken graph/integrity, exactly-one-solid, native-kernel, immutable-revision, or model-selection boundaries.

## Reconciliation finding

`generation_runs` remains the durable generation lifecycle **snapshot** and authority for current status/phase. Its bounded `detail` field is current-state prose, not ordered event history.

Phase F therefore adds the separate durable append-only `generation_run_events` ledger rather than overloading `generation_runs.detail` or creating a second lifecycle authority:

```text
generation_runs
  -> current durable lifecycle snapshot

generation_run_events
  -> bounded ordered diagnostic history for that run
```

Browser clients may read their own event rows under RLS. Runtime telemetry writes remain server-owned/service-role operations.

## F1 — Persisted structured telemetry

The event ledger records bounded structured telemetry for:

- external agent invocation number;
- canonical candidate received;
- canonical candidate rejected/accepted;
- bounded normalization/build error code and message;
- `build_brep_project` attempt number;
- build accepted/rejected;
- model step number;
- transport/result repair count;
- current context usage where available.

The ledger retains the newest 128 events per generation run while preserving monotonic per-run sequence numbers. Append sequencing is serialized against the parent generation run so concurrent telemetry sources cannot create duplicate sequence values.

Telemetry is privacy-safe by construction. It does not persist raw prompts, raw model output, canonical project payloads, tool payload bodies, or hidden reasoning. Persistence is fail-open: telemetry failure cannot alter model, repair, validation, build, or revision semantics.

Request-local telemetry uses the existing active-generation scope. Authoritative invocation, candidate, repair, model-step/context, and server-build points emit into one run-global sequence, so CLI/Streaming share the same observable outcome path without changing selected model, session identity, or Phase E repair limits.

The browser reads the ledger through the existing authenticated Supabase/RLS boundary. Client reconciliation filters by run identity, deduplicates by sequence, orders ascending, enforces the same 128-event bound, and treats legacy runs with no event rows as a valid empty ledger.

`shared/database.ts` remains generated authority and was not hand-edited at the schema boundary; the new table is isolated behind the repository's temporary local-cast pattern until the next schema-driven generated type refresh.

## F2 — Conversation progress UI

The existing `BrepCreationProgress` inline card remains the only generation-progress surface. Phase F does not introduce a parallel page or lifecycle model.

The compact card shows the latest durable activity. The existing collapsed `Generation details` section expands to show the bounded ordered agent/build event sequence with event number, human-readable structured label, bounded diagnostic text where applicable, timestamp, and the existing lifecycle/server detail rows.

Example rendered activity includes:

```text
Candidate 1 rejected — graph integrity
Repairing candidate · repair 1
Candidate 2 accepted
Validating build
Build rejected — disconnected union
Build accepted
```

Lifecycle status remains separately visible, including revision saving and native-preview preparation. Legacy runs without detailed telemetry retain the existing durable lifecycle UI. No hidden reasoning is synthesized or displayed.

## F3 — Reload/reconnect durability

The event ledger reuses the durable generation-run polling/reconciliation model.

The event query explicitly refetches on:

- component mount/browser reload;
- network reconnect;
- window focus/return to the conversation.

It continues background polling while the parent run is active.

Runtime telemetry writes are serialized through an asynchronous tail. To avoid missing the last queued event when the parent lifecycle snapshot becomes terminal first, the client retains a bounded five-second terminal settle window before stopping event polling. This captures a late final durable event without introducing permanent terminal polling.

Returning later reloads the full bounded ledger from server state, so correctness does not depend on the in-memory client event list.

## Repository evidence

Phase F implementation checkpoints:

```text
f4cada22a99ff62aa6046696d84d81f40d686332  Add durable generation run event ledger
466ea351a49d92f29e0ae11f7ee51f0bd4f52f69  Wire durable Native BRep generation telemetry
4bb8b8cc5327be857a24d65c90a0f40a49db5f55  Expose durable generation telemetry to clients
cf7f88b0c897fb33a2b788d7e8bc7abc3b764b2e  Show durable Native BRep agent activity
2228f97d5b1b0be93ecc906d608c76955309d66d  Harden durable generation telemetry reconciliation
```

CI evidence on the implementation series:

- `f4cada22...`: Quality Gate #1158 — PASS; Grasshopper Build #730 — PASS
- `466ea351...`: Quality Gate #1159 — PASS; Grasshopper Build #731 — PASS
- `4bb8b8cc...`: Quality Gate #1160 — PASS; Grasshopper Build #732 — PASS
- `cf7f88b0...`: Quality Gate #1161 — PASS; Grasshopper Build #733 — PASS
- `2228f97d...`: Quality Gate #1162 — PASS; Grasshopper Build #734 — PASS

## Exit criterion

Phase F's repository exit criterion is satisfied:

> A long BRep agent run can be understood without reading server logs.

The conversation UI can reconstruct the durable sequence of candidate validation, repair, model steps, context use, server build attempts, and outcomes from persisted structured state, including after reload/reconnect/return.

## Preserved boundaries

Phase F does not change:

- canonical `BrepProject` source authority;
- `schemaVersion: 1`;
- canonical geometry operations;
- exactly-one-solid Boolean semantics;
- fail-closed graph/integrity validation;
- build123d/OCCT native authority;
- Rhino/GHX interop authority boundary;
- immutable revision semantics;
- Phase E bounded repair budgets/outcome semantics;
- user-selected inference model routing.

PR #36 remains open, draft, stacked on `feature/brep-grasshopper-smart-component`, and unmerged.

## Next active phase

The next active scope is **Phase G — Context-growth measurement before compaction**.

Phase G must begin with reconciliation against the already-existing context-observability/budget implementation and evidence, especially:

- `docs/brep_ai_context_budget_plan.md`;
- `docs/brep_c1_context_observability_closeout.md`;
- `docs/brep_c25a_step_observability_status.md`;
- `docs/brep_c3_model_context_projection_status.md`;
- `docs/brep_c5_hard_context_budget_status.md`;
- `docs/brep_c6_reasoning_projection_status.md`;
- `src/server/aiContextDiagnostics.ts`;
- `src/server/aiContextBudget.ts`;
- `src/server/aiStepDiagnostics.ts`;
- current context/step instrumentation in `src/server/aiChat.ts`.

Do not add compaction in Phase G. Measure and classify the dominant context-growth source first.
