# Post-Phase 8 ROBUST-1 browser acceptance closeout

Date: 2026-09-09

Branch: `feature/brep-grasshopper-gh-packaging`

Status: **accepted for the current browser/server lifecycle**.

This note closes the browser-facing ROBUST-1 follow-up identified in `docs/post_phase8_product_ux_and_generation_status_plan.md`. Installed Rhino 8 / Grasshopper host acceptance remains a separate Phase 9 concern and is not claimed here.

## Accepted behavior

The current live/local acceptance confirms the intended durable-generation contract for the exercised BRep product flows:

- a later Native BRep AI edit remains correctly correlated to its current generation attempt;
- browser reload during active generation restores visible generation activity instead of degrading to an apparently idle chat;
- after reload, the model displayed for the active operation comes from the durable generation attempt rather than stale conversation/UI state;
- source/parameter edit exclusion still recovers from durable state and remains bounded to AI-owned source phases;
- the editor unlocks at `revision_saved`; native evaluation/viewer preparation may continue without unnecessarily keeping source editing locked;
- retry/edit attempt correlation does not accept an older terminal run as the current attempt;
- editing is intentionally available on user-turn cards only. Assistant cards are immutable generated outputs/revision history and are not made text-editable.

The final reload fix persists short-lived client attempt correlation in session storage while retaining `generation_runs` as the server-owned status authority. Session storage is only a handoff cursor for the browser; it does not become generation authority.

## Fix checkpoint

The live reload/model-hydration fix landed through:

```text
5ac671d3012e7fa6b557a52f7066d9ea730e5d15
Recover BRep chat activity across reloads
```

A nullable TypeScript narrowing defect found by CI was corrected at:

```text
af0fe91154059ed5b319dcb4ec136685975efeaf
Fix nullable BRep retry baseline narrowing
```

The same closeout also removed the unused direct `csv-parse` dev dependency and regenerated the npm lockfile after GitHub's dependency advisory became active. The audit gate was kept strict; it was not bypassed or weakened.

## Repository evidence

Exact code checkpoint before this documentation commit:

```text
af0fe91154059ed5b319dcb4ec136685975efeaf
```

Quality Gate #662 — PASS:

- dependency audit — PASS, 0 vulnerabilities;
- tests — PASS, 114 files / 763 tests;
- typecheck — PASS;
- lint — PASS;
- build — PASS;
- diff check — PASS.

Grasshopper Build #235 — PASS.

Manual local/browser acceptance after the reload fix — PASS for the exercised ROBUST-1 tranche, including the reload/status/model issue that was previously observed.

## Authority boundaries retained

- `conversation.type = 'parametric'` remains unchanged;
- Native BRep remains identified through `parametricSourceKind = 'brep'`;
- `generation_runs` remains server-written and owner-readable;
- immutable BRep messages/revisions remain authoritative lineage;
- assistant history remains immutable; only user turns are editable/branchable;
- source-write locking ends at `revision_saved`, not `preview_ready`;
- no fake progress percentages or browser-owned generation lifecycle were introduced;
- Settings/discovery remains the authority for selectable LLM models; no hard-coded hosted model fallback is reintroduced;
- GHX validation/import authority is unchanged;
- installed Rhino/Grasshopper acceptance remains Phase 9.

## Remaining non-blocking robustness boundary

Persisted generation status provides browser reload/reopen durability; it does not make an in-process generation survive a Brepia server process crash. A real queued worker/job executor is still required if process-restart job durability becomes a product requirement.

Background/mobile, explicit cancellation, provider/agent failure and reconnect stress cases can continue as regression coverage, but no browser-lifecycle defect from the accepted tranche remains open in this closeout.
