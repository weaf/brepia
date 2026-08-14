# OpenCode G01 Recovery Status

Plan: `docs/opencode_g01_recovery_plan.md`

Reviewed against pushed `local-dev-continue` on 2026-08-14.

## State

**State:** Recovery required before continuing G02

**Current next task:** `R04B — Extract shared final-result parser (src/server/opencodeAgentResult.ts); both transports call it`

**Execution rule:** exactly one R-task per coding-agent run; one writer to this branch/status file at a time.

## Pushed baseline reviewed

Branch head before recovery docs: `f8448ef026b73f338e97a433ac1ab19a4b318254`.

Observed pushed state:

- P through E are substantially implemented.
- F01 is committed (`cb01a2cd...`).
- F02 is committed (`f8448ef...`).
- The main status file is stale and still lists F01/F02 as TODO.
- The main status file records 46 passing tests at E04; user reports later F-phase validation remains green.
- `src/server/cliAgents.ts` is still absent from the pushed GitHub tree, despite tracked imports.
- `package.json` does not contain `@opencode-ai/sdk`; the actual pushed Streaming implementation remains raw HTTP/fetch.
- `src/server/opencode.ts` still contains two OpenCode model constructors (`opencodeChatModel` and `streamingOpencodeChatModel`) with largely duplicated V2 wrapper code.
- `/api/opencode/models` emits canonical picker IDs as `agent/opencode/<provider>/<model>`.
- F01 toggle visibility currently checks only `model.startsWith('opencode/')`.
- E03 Streaming selection currently checks only `actualModelId.startsWith('opencode/')`.
- `providerFor()` sends `agent/opencode/...` through `isCliAgentModel()` to the CLI path.

These routing facts must be reconciled before G01 is considered fixed.

## Recovery task table

| Task | Status | Summary                                                                      |
| ---- | ------ | ---------------------------------------------------------------------------- |
| R01  | DONE   | Preserve and inspect current uncommitted G01 WIP                             |
| R02  | DONE   | Reconcile status/docs with actual pushed code                                |
| R03  | DONE   | Make executionMode switch transport for the same canonical OpenCode model ID |
| R04  | TODO   | Track CLI adapter safely and extract shared final-result parser              |
| R05  | TODO   | Separate progressive text from final artifact/tool-call detection            |
| R06  | TODO   | Add false-positive, single-emission, and revision-loop regression tests      |
| R07  | TODO   | Re-evaluate real CLI/Streaming semantic parity and permissions assumptions   |
| R08  | TODO   | Full recovery validation gate before resuming G02                            |

## Critical invariants during recovery

- Preserve current uncommitted `src/server/opencode.ts` work before editing it.
- Never reset/clean/discard user work.
- Never overwrite local/untracked `src/server/cliAgents.ts`.
- Do not solve G01 by simply changing a keyword regex to another independent Streaming parser.
- CLI and Streaming must converge on one final-result parser.
- Prose containing `cube`, `rotate`, `cylinder`, etc. must never imply code by keyword alone.
- Progressive UI text may stream immediately; artifact/tool-call interpretation happens only on complete final agent output.
- Exactly one `build_parametric_model` call may be emitted for one explicit final artifact.
- One selected OpenCode model should switch CLI/Streaming through execution mode, not by requiring a different normal model ID.
- Do not continue to G02 until R08 passes.

## Coordinator findings that invalidate stale main-status assumptions

### SDK decision

The old main status says "Use @opencode-ai/sdk". The pushed implementation does not contain that dependency and uses raw HTTP/fetch. Treat the implemented decision as **raw HTTP** unless a later explicit task changes it.

### A05 semantic parity

The table says A05 is DONE, but the detailed A05 section remained unfilled and the current HTTP `formatPrompt()` explicitly disables tools/files. Semantic parity is therefore reopened through R07.

### Routing mismatch

Current pushed behavior is not yet a clean CLI/Streaming switch for the same OpenCode model:

```text
/api/opencode/models
  -> agent/opencode/<provider>/<model>

providerFor(agent/opencode/...)
  -> cli-agent

F01 toggle visibility
  -> only opencode/...

E03 Streaming condition
  -> only opencode/...
```

R03 must resolve this before parser work is considered complete.

## R01 evidence template

````text
branch: local-dev-continue
HEAD: 8ee7826 Add G01 recovery status tracker
git status --short:
 M docs/opencode_streaming_status.md
 M src/server/opencode.ts
?? .cortexkit/
?? .omo/
?? .playwright-mcp/
?? PLAN_llm_providers.md
?? box.scad
?? cube_with_hole.scad
?? src/server/cliAgents.ts
?? "treaming through phase F\"
current opencode.ts diff saved to .git/g01-before-recovery.patch: YES (3531 bytes)
extractOpenSCADCode/current heuristic:
  fenced-block-only: /```(?:openscad|scad)?\s*([\s\S]*?)```/i + min length /.{20,}/
  (no keyword heuristics remain)
tool-call emission location:
  streamingOpencodeChatModel ReadableStream.start() — at finish part,
  enqueues build_parametric_model tool-call then finish with finishReason:'tool-calls'
partial-vs-final detection behavior:
  detection only on terminal finish part; text deltas buffered, never parsed as fragments
duplicate guard already present: YES (single definition lines 28-39; earlier ~739 duplicate removed)
notes:
  - Comment claims "mirrors parseAgentResult exactly" but it is a SEPARATE parser:
    accepts ANY fenced block (optional lang tag) vs CLI parser which also accepts JSON.
    R04B must extract one shared parser.
  - Routing problem #1 (executionMode switching same model ID) is unaddressed by the WIP.
````

## R03 routing acceptance template

```text
canonical OpenCode UI ID:
underlying model extraction helper:
CLI route test: PASS/FAIL
Streaming route test: PASS/FAIL
toggle visibility test: PASS/FAIL
non-OpenCode regression: PASS/FAIL
```

## R04 shared-parser acceptance template

```text
cliAgents.ts tracked safely: YES/NO
shared parser module:
CLI uses shared parser: YES/NO
Streaming uses shared parser: YES/NO
accepted structured formats:
plain-prose false-positive test: PASS/FAIL
```

## R06 required regression results

```text
prose with cube/rotate/cylinder -> 0 build calls:
fenced SCAD final -> exactly 1 build call:
CLI-supported JSON final -> exactly 1 build call:
partial fence before terminal -> 0 build calls:
final fence + terminal same batch -> exactly 1 build call:
repeated snapshots -> exactly 1 build call:
follow-up prose after tool result -> 0 accidental build calls:
ordinary final text -> 0 build calls:
revision-loop regression -> PASS/FAIL:
```

## R08 validation gate

```text
npm run typecheck:
npm run lint:
npm run build:
all OpenCode/CLI/streaming tests:
manual same-model CLI test:
manual same-model Streaming test:
manual prose-keyword false-positive test:
ready to resume G02: YES/NO
```

## Implementation log

Append one section per recovery task:

```text
### YYYY-MM-DD — Rxx
Status: DONE | BLOCKED | SKIPPED
Repository state before task:
- branch:
- HEAD:
- relevant git status:
Files changed:
- ...
Evidence/change:
- ...
Validation:
- command -> PASS/FAIL
Notes:
- ...
Next task:
- ...
```

### 2026-08-14 — R01

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 8ee7826 (recovery docs pulled in; previously f8448ef)
- relevant git status:
  - M docs/opencode_streaming_status.md
  - M src/server/opencode.ts
  - ?? src/server/cliAgents.ts (untracked, protected)
  - ?? misc untracked user files (box.scad, cube_with_hole.scad, PLAN_llm_providers.md, etc.)
    Files changed:
- docs/opencode_streaming_status.md (added "G01 recovery — R01 WIP audit findings" section)
- docs/opencode_g01_recovery_status.md (R01 -> DONE, evidence template filled, log entry)
- .git/g01-before-recovery.patch (safety copy of opencode.ts diff; NOT committed)
  Evidence/change:
- Saved `git diff -- src/server/opencode.ts > .git/g01-before-recovery.patch` (3531 bytes)
- Audited WIP: extractOpenSCADCode() fenced-block-only heuristic at lines 28-39;
  tool-call emission at streamingOpencodeChatModel finish part; partial-vs-final OK;
  duplicate guard present (single definition; ~739 duplicate already removed).
- Documented failure mechanism: (a) comment claims CLI parity but parser is separate
  and looser on fenced blocks, (b) routing problem #1 unaddressed by WIP.
  Validation:
- git diff check (patch contents reviewed) -> PASS
- grep for extractOpenSCADCode / tool-call / finishReason -> PASS (single def, one emission site)
- no implementation code edited -> PASS
  Notes:
- R02 next (documentation reconciliation). Do not resume G02 until R08 passes.
  Next task:
- R02 — Reconcile status/documentation with actual pushed code

### 2026-08-14 — R02

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 8ee7826 Add G01 recovery status tracker
- relevant git status:
  - M docs/opencode_g01_recovery_status.md
  - M docs/opencode_streaming_status.md
  - M src/server/opencode.ts (preserved G01 WIP, untouched)
  - ?? src/server/cliAgents.ts (untracked, protected)
    Files changed:
- docs/opencode_streaming_status.md
  - Task table: A05 -> REOPENED (semantic parity, R07), B02 -> raw HTTP implemented
  - New section "R02 routing facts — reconciled against actual code" with file:line evidence
  - B02 SDK-vs-HTTP decision block rewritten to implemented decision (raw HTTP)
  - A05 semantic decision + B02 SDK decision templates filled with actual state
- docs/opencode_g01_recovery_status.md (R02 -> DONE, next task -> R03, log entry)
  Evidence/change:
- Verified against code:
  - /api/opencode/models emits `agent/opencode/<cliId>` (src/routes/api/opencode/models.ts:21)
  - F01 toggle visibility: model.startsWith('opencode/') (src/components/TextAreaChat.tsx:1736)
  - E03 streaming selection: actualModelId.startsWith('opencode/') && executionMode==='streaming' (src/server/aiChat.ts:1272)
  - providerFor(): isCliAgentModel() -> 'cli-agent' (src/server/aiChat.ts:346)
  - package.json does NOT contain @opencode-ai/sdk -> implemented decision is raw HTTP
- Recorded consequence: canonical agent/opencode/... picker IDs cannot switch CLI/Streaming by executionMode today (R03).
- Recorded reproducibility issue: src/server/cliAgents.ts still absent from pushed GitHub tree (R04A).
  Validation:
- grep verification of routing facts against code -> PASS (all 5 facts confirmed)
- package.json check -> PASS (no @opencode-ai/sdk)
- no implementation code edited -> PASS (documentation-only)
  Notes:
- Status now reflects code, not earlier design intentions. Next: R03 (code correction).
  Next task:
- R03 — Make execution mode switch transport for the SAME OpenCode model

### 2026-08-14 — R03

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 8ee7826 Add G01 recovery status tracker
- relevant git status:
  - M src/server/aiChat.ts, M src/server/opencode.ts (preserved G01 WIP + R03), M shared/models.ts, M src/components/TextAreaChat.tsx
  - ?? src/server/cliAgents.ts (untracked, protected — R03 helper added here)
  - ?? src/server/opencodeRouting.test.ts (new R03 routing tests)
    Files changed:
- src/server/cliAgents.ts (untracked, protected): added `opencodeAgentUnderlyingModelId()` (canonical ID -> provider/model) and `selectChatTransport()` (transport decision for a model ID + executionMode)
- src/server/aiChat.ts: E03 block now calls `selectChatTransport(actualModelId, executionMode)`; streaming uses `streamingOpencodeChatModel(underlyingModelId)`, everything else falls through to `buildChatModel`
- shared/models.ts: added `isOpenCodeAgentModel()` (canonical `agent/opencode/...` predicate) and `isOpenCodeTransportModel()` (canonical + legacy)
- src/components/TextAreaChat.tsx: F01 toggle visibility now uses `isOpenCodeTransportModel(model)` instead of `model.startsWith('opencode/')`
- src/server/opencodeRouting.test.ts (new): 9 routing tests, copied-selectChatTransport pattern (see opencodeEvents.test.ts)
- docs/opencode_g01_recovery_status.md (this file: R03 -> DONE)
  Evidence/change:
- R03 semantics: canonical `agent/opencode/<provider>/<model>` + cli -> `{ kind: 'cli-agent' }` (buildChatModel -> cliAgentChatModel); + streaming -> `{ kind: 'streaming-opencode', underlyingModelId }` (streamingOpencodeChatModel). Legacy `opencode/...` + streaming -> streaming pass-through; + cli -> normal (falls through to opencodeChatModel, today's behavior).
- Legacy `opencode/...` IDs treated as compatibility only (R03 step 5); canonical path never requires a different model ID to switch transport.
- Toggle now visible for canonical agent IDs (was hidden) — the F01 gap identified in R02 is closed.
  Validation:
- node --test src/server/opencodeRouting.test.ts -> PASS (9/9)
- node --test src/server/\*.test.ts -> PASS (50/50, was 41 before R03; +9 routing tests)
- npm run typecheck -> PASS
- npm run lint -> PASS (0 errors; 15 pre-existing warnings)
- npm run build -> PASS
  Notes:
- R04 next: track CLI adapter safely (R04A inspect+git add) and extract shared final-result parser (R04B).
  Next task:
- R04A — Inspect cliAgents.ts for secrets/paths; if clean, git add intentionally; typecheck + tests

### 2026-08-14 — R04A

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 8ee7826 Add G01 recovery status tracker
- relevant git status:
  - M src/server/aiChat.ts (R03 routing, uncommitted)
  - M src/server/opencode.ts (preserved G01 WIP)
  - M shared/models.ts, M src/components/TextAreaChat.tsx (R03)
  - ?? src/server/cliAgents.ts (untracked, protected)
  - ?? src/server/opencodeRouting.test.ts (R03 tests)
    Files changed:
- src/server/cliAgents.ts (untracked -> intentionally staged for commit; NOT rewritten)
- docs/opencode_g01_recovery_status.md (this file: R04A -> DONE)
  Evidence/change:
- Inspected src/server/cliAgents.ts end-to-end: no secrets, no machine-specific
  paths (uses tmpdir()), no temporary debug data, no unrelated content. Only env
  read is `CODEX_MODELS` (a config key name, not a value).
- Confirmed it is the adapter already used by tracked imports:
  - src/server/aiChat.ts:45 `from './cliAgents'` (cliAgentChatModel, isCliAgentModel, selectChatTransport)
  - src/routes/api/opencode/models.ts:9 `from '@/server/cliAgents'` (configuredCodexModels)
- A fresh checkout previously failed to compile: aiChat.ts and the models route
  import this file, yet it was absent from the pushed tree. Now staged intentionally.
- NOT rewritten (per R04A: "Do not rewrite the adapter merely because it was
  previously untracked").
  Validation:
- npm run typecheck -> PASS (0 errors)
- node --test src/server/opencodeRouting.test.ts src/server/opencodeApiUrl.test.ts src/server/opencodeEvents.test.ts src/server/opencodeStreamTests.test.ts -> PASS (37/37)
  Notes:
- R03 + R04A committed together because aiChat.ts (R03) imports
  `selectChatTransport` from cliAgents.ts (R04A) — a separate commit would not
  compile. The preserved G01 WIP in src/server/opencode.ts stays uncommitted
  until R08 validates it.
  Next task:
- R04B — Extract shared final-result parser to src/server/opencodeAgentResult.ts;
  both transports must call the same parser (determine formats from
  parseAgentResult; do not invent a new schema).

> Read `docs/opencode_g01_recovery_status.md` first. Work only on its `Current next task`. Read only the matching R-task section from `docs/opencode_g01_recovery_plan.md`. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Preserve the current uncommitted `src/server/opencode.ts` work before editing and never reset/clean/discard user work or overwrite local `src/server/cliAgents.ts`. Implement exactly one recovery task, run its focused validation, update `docs/opencode_g01_recovery_status.md` with evidence/result, set the next R-task only if DONE, then stop. Do not resume the main G02 task until R08 passes.
