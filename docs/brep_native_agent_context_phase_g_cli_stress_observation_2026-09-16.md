# Native BRep Phase G CLI stress observation — 2026-09-16

Status: **pre-G2 runtime observation; not sufficient to classify Phase G2 context growth**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Runtime fixture

The first post-Phase-F Native BRep stress attempt used:

- transport: OpenCode CLI;
- model: `llama-swap/qwen3.8-27b-mtp-128k`;
- generation phase reached: `generating`;
- durable telemetry ledger operational after applying the Phase F migration.

The durable UI recorded:

- model step 1;
- context usage estimate: 1,621 tokens;
- no canonical BRep candidate/build event before termination.

The run started at approximately `2026-09-16T07:45:12Z` and completed at approximately `2026-09-16T07:53:12Z`.

The server terminal error was:

```text
opencode timed out after 480000 ms
```

The subsequent BRep finalization error was expected fallout from the missing canonical project artifact, not the root cause:

```text
Native BRep creation finished without a canonical project artifact.
```

## Classification

This run does **not** close G2.

Reasons:

1. CLI agent adapters do not currently expose authoritative external-session token usage; their compatibility zero-usage values must remain classified as unavailable rather than zero.
2. The run ended during the first model step, so there are no consecutive step/repair deltas from which to classify context growth.
3. The hard 480,000 ms transport wall-clock timeout terminated the invocation before a canonical candidate was returned.

The 1,621-token durable context record is therefore Brepia-side deterministic context evidence, not proof of the total OpenCode CLI session context.

## Runtime defect exposed by the fixture

Both current OpenCode transport defaults were 480,000 ms wall-clock limits:

- `transport.cliTimeoutMs` for one CLI invocation;
- `transport.openCodeTimeoutMs` for one Streaming OpenCode request.

The Streaming implementation also uses a total wall-clock timer rather than an idle timer. Leaving that default unchanged would risk turning the same eight-minute cutoff into a false G2 failure when the representative persistent Streaming run is performed.

The bounded follow-up is therefore to raise both repository defaults to 1,200,000 ms (20 minutes) while preserving:

- per-user runtime overrides;
- the existing 30-second minimum;
- the existing 3,600,000 ms (60 minute) maximum;
- explicit user cancellation;
- all canonical BRep, validation, revision and transport-repair semantics.

## Observability note

The durable UI correctly preserved the run status and two telemetry events, but its terminal summary only displayed `Generation failed.`. The exact transport timeout remained visible only in the server log.

That is a concrete Phase F observability hardening item. It should be addressed with a bounded/safe terminal diagnostic path rather than persisting arbitrary provider or raw model output.

No new telemetry schema or canonical geometry operation is introduced by this observation.

## G2 next gate

After the timeout default is accepted and the local branch is updated, perform the representative Native BRep run with **OpenCode Streaming**, not CLI.

Capture:

- request-static `ai context diagnostics`;
- consecutive `ai step started` records;
- `ai step diagnostics` including provider/OpenCode token usage when reported;
- final `ai context actual usage`;
- durable model-step, repair and build-attempt activity.

Only that evidence may select the dominant context-growth class and unblock Phase H.
