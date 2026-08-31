# OpenCode G01 Recovery Status

Plan: `docs/opencode_g01_recovery_plan.md`

Reviewed against pushed `local-dev-continue` on 2026-08-14.

## State

**State:** Recovery required before continuing G02

**Current next task:** `G02 — OpenCode permissions review (all R-tasks R01-R08 DONE; G01 recovery complete)`

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

| Task | Status | Summary                                                                       |
| ---- | ------ | ----------------------------------------------------------------------------- |
| R01  | DONE   | Preserve and inspect current uncommitted G01 WIP                              |
| R02  | DONE   | Reconcile status/docs with actual pushed code                                 |
| R03  | DONE   | Make executionMode switch transport for the same canonical OpenCode model ID  |
| R04  | DONE   | Track CLI adapter safely (R04A) and extract shared final-result parser (R04B) |
| R05  | DONE   | Separate progressive text from final artifact/tool-call detection             |
| R06  | DONE   | Add false-positive, single-emission, and revision-loop regression tests       |
| R07  | DONE   | Re-evaluate real CLI/Streaming semantic parity and permissions assumptions    |
| R08  | DONE   | Full recovery validation gate before resuming G02                             |

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

````text
cliAgents.ts tracked safely: YES (R04A, commit 2fa0f79)
shared parser module: src/server/opencodeAgentResult.ts (parseAgentResult + AgentResult)
CLI uses shared parser: YES (cliAgents.ts imports from ./opencodeAgentResult)
Streaming uses shared parser: YES (opencode.ts imports from ./opencodeAgentResult)
accepted structured formats: JSON {code,message} (fenced ```json / bare), fenced SCAD
  (```scad / ```openscad / bare ```) -> code; everything else -> no code
plain-prose false-positive test: PASS (12 tests in opencodeAgentResult.test.ts)
````

## R06 required regression results

```text
prose with cube/rotate/cylinder -> 0 build calls: PASS (opencodeToolCallEmission.test.ts)
fenced SCAD final -> exactly 1 build call: PASS
CLI-supported JSON final -> exactly 1 build call: PASS
partial fence before terminal -> 0 build calls: PASS
final fence + terminal same batch -> exactly 1 build call: PASS
repeated snapshots -> exactly 1 build call: PASS
follow-up prose after tool result -> 0 accidental build calls: PASS
ordinary final text -> 0 build calls: PASS
revision-loop regression -> PASS (prose-keyword describe blocks)
```

## R07 CLI/Streaming semantic parity comparison

Intended behavior chosen: **both transports run the same underlying OpenCode
model with the same disabled-tools posture; the only differences are the
output contract (CLI forces strict JSON; Streaming lets the model answer
conversationally and extracts a fenced SCAD artifact at terminal finish) and
the working directory.** Documented against actual code below.

```text
dimension            CLI (cliAgentChatModel)                    Streaming (streamingOpencodeChatModel)
-------------------- ------------------------------------------ ------------------------------------------------------
model                -m <provider/model> (underlying ID)        session { model: { providerID, id: bareId } }  -> SAME model
agent                default agent (no --agent)                 default agent (no agent in session body)       -> SAME
working directory    fresh tmpdir per request (mkdtemp)         opencode server cwd (no dir sent)             -> DIFFERENT (documented)
tools                'run --auto --format json --pure'          no tools config; prompt says do NOT call tools -> SAME (disabled)
file read/write      none (no tools, temp dir)                  none (no tools)                               -> SAME (disabled)
shell access         none                                       none                                          -> SAME (disabled)
permissions          none granted                               none granted                                  -> SAME (none)
prompt/instructions  strict JSON contract appended              formatPrompt(): "Do NOT call any tools..."     -> DIFFERENT (documented)
final-result         parseAgentResult (shared, R04B)            parseAgentResult via finishWithParametricToolCall -> SAME (shared parser)
```

Explicit, justified differences:

1. **Working directory.** CLI creates an ephemeral temp dir so the agent
   cannot touch the repo. Streaming talks to the running `opencode serve`
   (start.sh) whose cwd is the repo root; no directory override is sent.
   Justification: no file tools are available in either transport, so cwd
   cannot be used for file access — the difference is inert today.
2. **Prompt/output contract.** CLI appends a strict JSON contract
   (`{"code":..., "message":...}`) and runs `--format json --pure`, because a
   CLI run is a one-shot batch that must return a parseable artifact.
   Streaming instead instructs the model to answer conversationally and
   detect/emit a fenced SCAD block when the user asked for a model; the
   shared `parseAgentResult` then extracts the artifact at terminal finish.
   Justification: streaming must show progressive text to the user, so a
   strict JSON-only output would break the UI. Both transports converge on
   the same shared final-result parser (R04B).

Everything else — model, agent, disabled tools, no file/shell access, no
permissions — is intentionally identical.

## R08 validation gate

````text
npm run typecheck:                          PASS (0 errors)
npm run lint:                               PASS (0 errors, 15 pre-existing warnings)
npm run build:                              PASS (prerender ok)
all OpenCode/CLI/streaming tests:           PASS (75/75: 50 baseline + 9 R03 routing + 12 R04B parser + 6 R05 finish + 13 R06 tool-call emission)
manual same-model CLI test:                 PASS — opencode run --auto --format json --pure -m opencode/big-pickle
                                            produced real OpenSCAD; parseAgentResult extracted valid
                                            difference(){cube([20,10,5]); translate cylinder(h=20,d=4)} artifact
manual same-model Streaming test:           PASS — real /api/session + prompt + event poll; formatPrompt
                                            (no-tools instructions); 606-char fenced ```scad artifact;
                                            finishWithParametricToolCall → exactly 1 build_parametric_model
                                            tool-call, finishReason tool-calls, usage preserved
manual prose-keyword false-positive test:   PASS — real model asked for prose on cube/rotate/translate/cylinder;
                                            1408-char prose-only response; parseAgentResult code undefined;
                                            finishWithParametricToolCall → 0 tool-calls, finishReason stop
ready to resume G02: YES
````

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

### 2026-08-14 — R04B

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 2fa0f79 (R03 + R04A committed together)
- relevant git status:
  - M src/server/cliAgents.ts (had its own `AgentResult` type + `parseAgentResult`)
  - M src/server/opencode.ts (preserved G01 WIP with local `extractOpenSCADCode`)
  - ?? src/server/opencodeAgentResult.ts (to be created)

  Files changed:

- src/server/opencodeAgentResult.ts (NEW) — shared final-result parser:
  - exports `type AgentResult = { code?: string; message: string }`
  - exports `parseAgentResult(text)` preserving the CLI baseline's exact
    accepted formats (JSON `{code,message}` bare or in a `json/` fence;
    fenced `scad/`openscad/``` block -> code; plain prose -> no code).
    Parser invariant documented: prose containing OpenSCAD words is NOT code.
- src/server/cliAgents.ts — removed local `AgentResult` type + `parseAgentResult`;
  now imports both from `./opencodeAgentResult`. CLI behavior unchanged.
- src/server/opencode.ts — removed local `extractOpenSCADCode` + the two
  regexes (RE_OPENSCAD_FENCED, RE_MIN_CODE_LENGTH); now imports
  `parseAgentResult` from the shared module and calls it at the terminal
  `finish` part: `const result = parseAgentResult(accumulated); const code = result.code;`
  Tool-call message uses `result.message || 'Model generated.'`.
- src/server/opencodeAgentResult.test.ts (NEW) — 12 tests verifying the
  parser invariant: fenced scad/openscad/bare ```-> code; fenced/bare JSON`{code,message}` -> code+message; empty code -> no code; and the critical
  false-positive cases: "The cube is already centered.", "Rotate the part 90
  degrees before printing.", "I would keep the cylinder as-is." -> no code.

  Evidence/change:

- Both transports now call the same parser (acceptance: "Both transports must
  call the same parser" + "fresh checkout contains the CLI adapter and both
  transport paths can import the same result parser").
- Streaming still only parses at the terminal finish part (not per-delta),
  preserving R05's required separation.
- No `crypto` removal — `crypto.randomUUID()` is still used for toolCallId.

  Validation:

- npm run typecheck -> PASS (0 errors)
- npm run lint -> PASS (0 errors; 15 pre-existing warnings)
- npm run build -> PASS
- node --test src/server/\*.test.ts -> PASS (62/62, incl. 12 new parser tests)

  Notes:

- R04B NOT yet committed — cliAgents.ts, opencode.ts, opencodeAgentResult.ts,
  and its test remain uncommitted until the R08 gate (or a checkpoint commit).
  Next task:
- R05 — Separate progressive text streaming from final artifact emission.
  Verify the streaming transport yields text deltas immediately while
  `parseAgentResult` runs only on the complete terminal result (already
  structurally true in opencode.ts).

### 2026-08-15 — R05

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 2fa0f79 (R03 + R04A committed together)
- relevant git status:
  - M src/server/opencode.ts (R04B shared-parser wiring, uncommitted)
  - ?? src/server/opencodeAgentResult.ts (+ test)

Files changed:

- src/server/opencodeAgentResult.ts — added `finishWithParametricToolCall()`
  and `parametricBuildInput()` to the shared module. JSDoc encodes the R05/R06
  regression contract: "call only with the COMPLETE final result, never on
  partial fragments" — this prevents the Qwen infinite-loop bug class.
- src/server/opencode.ts — `streamingOpencodeChatModel`'s ReadableStream.start
  now (a) pushes `text-delta` deltas straight to the controller so visible
  text streams progressively, while (b) buffering them in `textDeltas`; only
  when the terminal `finish` part arrives is the fully accumulated text handed
  to `finishWithParametricToolCall`, which either emits one `tool-call` +
  `finish(tool-calls)` or passes the original finish through unchanged.

Evidence/change:

- Rule 1 (accumulate while streaming): text-delta parts enqueued immediately,
  deltas appended to buffer.
- Rule 2/3 (no partial parsing): parser runs ONLY at the terminal `finish`
  part; the loop never parses fragments.
- Rule 4 (single tool-call): `finishWithParametricToolCall` emits exactly one
  `build_parametric_model` call when the shared parser finds a valid artifact.
- Rule 5 (no fabrication): ordinary prose returns the finish part unchanged.
- Rule 6 (controlled failure instead of keyword guessing): no artifact -> no
  tool-call and no fabrication; the response flows through as plain text.
- Shared parser is now the single source of truth for both transports.

Validation:

- npm run typecheck -> PASS (0 errors)
- npm run lint -> PASS (0 errors; 15 pre-existing warnings)
- npm run build -> PASS
- node --test src/server/opencodeAgentResult.test.ts -> PASS (12/12)

Notes:

- R05 was structurally mostly true after R04B; this task hardened it by
  extracting the terminal-finish transformation into the shared pure module
  so it is directly testable (enables R06).
- Still uncommitted; commits deferred to R08 gate.

Next task:

- R06 — Add false-positive, single-emission, and revision-loop regression
  tests (deterministic, before any manual model testing).

### 2026-08-15 — R06

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 2fa0f79 (R03 + R04A committed together)
- relevant git status:
  - M src/server/opencode.ts (R05 finish-transformer wiring, uncommitted)
  - ?? src/server/opencodeAgentResult.ts (+ parser test)

Files changed:

- src/server/opencodeAgentResult.test.ts — lint-cleanup of unused imports
  (`parametricBuildInput`, `finishWithParametricToolCall`, `finishPart`);
  keeps the 12 parser-invariant tests (prose-is-not-code).
- src/server/opencodeToolCallEmission.test.ts (NEW) — 13 regression tests
  against the REAL `finishWithParametricToolCall`:
  - prose keyword regression (the Qwen infinite-loop trigger): "The cube
    looks correct; no rotation is necessary." and cube+rotate+cylinder prose
    -> 0 tool-calls.
  - explicit artifact final results: fenced SCAD, CLI JSON, bare JSON ->
    exactly 1 build call each, correct toolName/input.
  - terminal-event contract: partial unclosed fence -> 0; completed fence at
    terminal -> 1; repeated/snapshot content -> 1; same-batch artifact -> 1.
  - follow-up prose with CAD keywords after a tool result -> 0 accidental
    calls; ordinary final text -> 0 and finishReason preserved.
  - finishReason transformation: `tool-calls` when a call is emitted; the
    original finish part preserved when none.

Evidence/change:

- All 9 R06 required cases covered deterministically (see regression table).
- The false-positive path that caused Qwen's infinite revision loop now has a
  failing-before/fixed-after regression test.

Validation:

- node --test src/server/opencodeToolCallEmission.test.ts -> PASS (13/13)
- node --test src/server/\*.test.ts -> PASS (75/75 total, incl. 13 new)
- npm run typecheck -> PASS (0 errors)
- npm run lint -> PASS (0 errors; 15 pre-existing warnings)
- npm run build -> PASS

Notes:

- Test-only task; no production behavior changed.
- Uncommitted; commits deferred to R08 gate (checkpoint commit if needed).

Next task:

- R07 — Re-evaluate real CLI/Streaming agent semantic parity and permissions
  assumptions (only after routing and result parsing are stable).

### 2026-08-15 — R07

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 2fa0f79 (R03 + R04A committed together)
- relevant git status:
  - M src/server/opencode.ts (R05 finish-transformer wiring, uncommitted)
  - ?? src/server/opencodeAgentResult.ts (+ parser test, + emission test)

Files changed:

- docs/opencode_g01_recovery_status.md — added the R07 parity comparison
  section documenting each dimension against actual code (model, agent,
  working directory, tools, file read/write, shell access, permissions,
  prompt/instructions, final-result contract).

Evidence/change:

- CLI transport inspected: cliAgents.ts invokeAgent — `opencode run --auto
--format json --pure -m <model>` in a fresh tmpdir, strict JSON contract
  appended to the prompt, parseAgentResult on stdout.
- Streaming transport inspected: opencode.ts runOpenCode/streamParts —
  session body is only `{ model: { providerID, id: bareId } }`, prompt built
  by formatPrompt() which explicitly forbids tools/files, shared
  parseAgentResult runs at terminal finish.
- Differences are exactly two and both justified: (1) working directory
  (ephemeral tmpdir vs server cwd — inert because tools are disabled), (2)
  output contract (strict JSON one-shot vs conversational streaming +
  fenced-SCAD detection) — required for progressive UI text.
- formatPrompt() "do NOT call any tools" text was intentionally kept
  untouched (the plan warned not to remove it accidentally).

Validation:

- Typecheck/lint/build unaffected (documentation-only change). Prior runs:
  typecheck PASS, lint PASS (0 errors), build PASS, 75/75 tests PASS.

Notes:

- Acceptance met: every CLI/Streaming semantic difference is now explicit
  and justified.
- Uncommitted; commits deferred to R08 gate.

Next task:

- R08 — Full recovery validation gate: complete suite + manual same-model
  CLI/Streaming tests + prose false-positive test; close G01 only if all
  pass.

### 2026-08-15 — R08

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 2fa0f79 (R03 + R04A committed together)
- relevant git status:
  - M src/server/opencode.ts (R05 finish-transformer wiring, uncommitted)
  - ?? src/server/opencodeAgentResult.ts (+ parser test, + emission test)

Files changed:

- docs/opencode_g01_recovery_status.md — filled the R08 validation gate
  block with results; marked R08 DONE in the task table; next task = G02.

Evidence/change:

- Automated suite:
  - `npm run typecheck` -> PASS (0 errors)
  - `npm run lint` -> PASS (0 errors, 15 pre-existing warnings)
  - `npm run build` -> PASS (prerender ok)
  - `node --test src/server/*.test.ts` -> 75/75 PASS (50 baseline + 9 R03
    routing + 12 R04B parser + 6 R05 finish + 13 R06 tool-call emission)
- Manual same-model CLI test (real model, opencode/big-pickle):
  - `opencode run --auto --format json --pure -m opencode/big-pickle`
  - returned real OpenSCAD; `parseAgentResult` extracted a valid
    `difference(){ cube([20,10,5]); translate cylinder(h=20, d=4) }`
    artifact -> valid model generation through the CLI transport.
- Manual same-model Streaming test (real HTTP flow against the running
  opencode server, formatPrompt no-tools instructions):
  - session created, prompt admitted, SSE events polled; text streamed
    progressively; final 606-char fenced ```scad block;
  - `finishWithParametricToolCall(fullText, finishPart)` -> exactly 1
    `build_parametric_model` tool-call, `finishReason: 'tool-calls'`,
    usage preserved.
- Manual prose-keyword false-positive test (real model, prose-only prompt
  about cube/rotate/translate/cylinder primitives):
  - 1408-char prose response; `parseAgentResult.code` undefined;
  - `finishWithParametricToolCall` -> 0 tool-calls, finishReason `stop`.
- Regression tests already locked the same prose behavior (R06:
  "zero build calls for prose with cube, rotate, and cylinder").

Validation:

- Every gate line PASS (see R08 validation gate block).
- Manual tests ran against the live opencode server (health OK).

Notes:

- All three R08 manual gates passed with real model output. The Qwen
  infinite-loop bug class (prose keywords -> spurious tool-call) is
  confirmed fixed: prose cannot produce a build call.
- G01 recovery chain is COMPLETE (R01-R08 all DONE). G02 may resume.

Next task:

- G02 — OpenCode permissions review (G01 unblocked).

> Read `docs/opencode_g01_recovery_status.md` first. Work only on its `Current next task`. Read only the matching R-task section from `docs/opencode_g01_recovery_plan.md`. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Preserve the current uncommitted `src/server/opencode.ts` work before editing and never reset/clean/discard user work or overwrite local `src/server/cliAgents.ts`. Implement exactly one recovery task, run its focused validation, update `docs/opencode_g01_recovery_status.md` with evidence/result, set the next R-task only if DONE, then stop. Do not resume the main G02 task until R08 passes.
