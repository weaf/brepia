# OpenCode G01 Recovery Status

Plan: `docs/opencode_g01_recovery_plan.md`

Reviewed against pushed `local-dev-continue` on 2026-08-14.

## State

**State:** Recovery required before continuing G02

**Current next task:** `R01 — Preserve and inspect the current G01 WIP`

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

| Task | Status | Summary |
|---|---|---|
| R01 | TODO | Preserve and inspect current uncommitted G01 WIP |
| R02 | TODO | Reconcile status/docs with actual pushed code |
| R03 | TODO | Make executionMode switch transport for the same canonical OpenCode model ID |
| R04 | TODO | Track CLI adapter safely and extract shared final-result parser |
| R05 | TODO | Separate progressive text from final artifact/tool-call detection |
| R06 | TODO | Add false-positive, single-emission, and revision-loop regression tests |
| R07 | TODO | Re-evaluate real CLI/Streaming semantic parity and permissions assumptions |
| R08 | TODO | Full recovery validation gate before resuming G02 |

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

```text
branch:
HEAD:
git status --short:
current opencode.ts diff saved to .git/g01-before-recovery.patch: YES/NO
extractOpenSCADCode/current heuristic:
tool-call emission location:
partial-vs-final detection behavior:
duplicate guard already present:
notes:
```

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

## Prompt for Qwen during recovery

> Read `docs/opencode_g01_recovery_status.md` first. Work only on its `Current next task`. Read only the matching R-task section from `docs/opencode_g01_recovery_plan.md`. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Preserve the current uncommitted `src/server/opencode.ts` work before editing and never reset/clean/discard user work or overwrite local `src/server/cliAgents.ts`. Implement exactly one recovery task, run its focused validation, update `docs/opencode_g01_recovery_status.md` with evidence/result, set the next R-task only if DONE, then stop. Do not resume the main G02 task until R08 passes.