# OpenCode G01 Recovery Plan

Reviewed against pushed branch `local-dev-continue` on 2026-08-14.

This file is intentionally small and operational. It exists because the broad P–I plan was too easy for a 35B-class coding model to interpret incorrectly once the implementation reached semantic parity.

## Why G01 is blocked

There are **three separate problems**, not one regex bug.

### 1. Model identity and transport routing are inconsistent

The pushed model route returns OpenCode agent IDs as:

```text
agent/opencode/<provider>/<model>
```

But the pushed UI toggle is only shown for:

```text
opencode/...
```

and the streaming selection in `aiChat.ts` is also only activated for:

```text
actualModelId.startsWith('opencode/')
```

At the same time, `providerFor()` routes `agent/opencode/...` through `isCliAgentModel()` to the CLI adapter.

Therefore the currently pushed code does **not yet guarantee that one OpenCode model ID can switch between CLI and Streaming using `executionMode`**.

This must be fixed before treating G01 as a parser-only problem.

### 2. CLI and Streaming result interpretation have drifted

The local CLI adapter contains `parseAgentResult`, which reportedly accepts structured final results such as fenced `scad` output and JSON.

The in-progress Streaming G01 work added/started adding a keyword heuristic that can interpret prose containing words such as `cube` or `rotate` as OpenSCAD code.

That creates false `build_parametric_model` calls and can drive the outer pCAD revision loop indefinitely.

**Required rule:** CLI and Streaming must use one shared final-result parser. Streaming must not have a looser keyword heuristic.

### 3. Streaming text and artifact detection are different concerns

Text should appear progressively in the UI.

OpenSCAD artifact/tool-call detection should happen from the **complete final OpenCode result**, not from incomplete streaming fragments.

Partial text such as:

````text
Here is the model:

```scad
cube(
````

is not yet a valid completed artifact and must not trigger `build_parametric_model`.

---

# Operating rule

Run exactly one recovery task per coding-agent invocation.

Before every task:

```bash
git branch --show-current
git status --short
git log -1 --oneline
```

Do not discard the current uncommitted `src/server/opencode.ts` G01 investigation.

Do not use `git reset --hard`, `git clean`, or overwrite local/untracked `src/server/cliAgents.ts`.

---

# R01 — Preserve and inspect the current G01 WIP

**Audit only. No implementation.**

1. Confirm the only expected current G01 worktree modification is `src/server/opencode.ts` (plus any known user files).
2. Save a safety copy of its diff without modifying the worktree:

```bash
git diff -- src/server/opencode.ts > .git/g01-before-recovery.patch
```

3. Read the diff and document:
   - `extractOpenSCADCode` or equivalent additions;
   - every heuristic used to decide that text is OpenSCAD;
   - where a tool-call is emitted;
   - whether detection runs on partial deltas or only terminal/final output;
   - duplicate-removal logic already attempted.
4. Do not edit the implementation in this task.
5. Update `docs/opencode_streaming_status.md` with the findings.

**Acceptance:** the current WIP is preserved and its exact failure mechanism is documented.

---

# R02 — Reconcile status/documentation with actual pushed code

**Documentation-only task.**

Correct these known inconsistencies:

1. The actual pushed implementation uses raw HTTP/fetch. `@opencode-ai/sdk` is not in `package.json`. Record raw HTTP as the implemented decision unless the code is deliberately changed later.
2. A05 semantic parity is not actually complete merely because the task table once marked it DONE. Reopen semantic parity until CLI and Streaming behavior is explicitly compared.
3. Record the pushed routing facts:
   - `/api/opencode/models` -> `agent/opencode/...`;
   - F01 toggle -> currently checks `opencode/...`;
   - E03 streaming selector -> currently checks `opencode/...`;
   - `agent/opencode/...` -> CLI through `isCliAgentModel()`.
4. Record that `src/server/cliAgents.ts` is still not present in the pushed GitHub tree and remains a reproducibility issue until deliberately committed.

**Acceptance:** status reflects code, not earlier design intentions.

---

# R03 — Make execution mode switch transport for the SAME OpenCode model

This is the highest-priority code correction.

## Required behavior

One canonical UI OpenCode agent ID must represent the model regardless of transport.

Preferred existing canonical form:

```text
agent/opencode/<provider>/<model>
```

because `/api/opencode/models` already emits this form and the CLI adapter already understands it.

For the same selected model:

```text
executionMode = cli       -> CLI adapter
executionMode = streaming -> Streaming OpenCode HTTP adapter
```

Transport must not be encoded by selecting a different model ID.

## Steps

1. Inspect `isCliAgentModel()` and the exact local CLI ID parser in `src/server/cliAgents.ts`.
2. Add/reuse a small helper that recognizes canonical OpenCode agent IDs and extracts the underlying OpenCode `provider/model` ID.
3. Update `aiChat.ts` transport selection so `executionMode` chooses CLI vs Streaming for the canonical OpenCode agent ID.
4. Update F01 toggle visibility to use the same canonical OpenCode-agent predicate rather than `model.startsWith('opencode/')`.
5. Treat any old `opencode/...` IDs as legacy compatibility only if they genuinely exist in persisted conversations. Do not create a second normal path.
6. Add focused routing tests.

## Required tests

```text
agent/opencode/llama-swap/qwen... + cli       -> cliAgentChatModel
agent/opencode/llama-swap/qwen... + streaming -> streamingOpencodeChatModel with underlying llama-swap/qwen...
non-OpenCode model + cli/streaming             -> unchanged normal provider routing
OpenCode agent model                           -> toggle visible
non-OpenCode model                             -> toggle hidden
```

**Acceptance:** changing only the execution-mode setting changes transport for the same selected OpenCode model.

---

# R04 — Make the CLI adapter reproducible and extract one shared result parser

This task has two tightly related goals because Streaming parity cannot be validated against a file that does not exist in a fresh checkout.

## R04A — Track the CLI adapter safely

1. Inspect local `src/server/cliAgents.ts` for secrets, machine-specific paths, temporary debug data, or unrelated content.
2. If clean and it is the adapter already used by the tracked imports, add it to Git intentionally.
3. Run typecheck and its relevant tests before committing.

Do not rewrite the adapter merely because it was previously untracked.

## R04B — Extract parser without changing semantics

Move only the final-result interpretation into a shared module, for example:

```text
src/server/opencodeAgentResult.ts
```

Exact naming should follow project conventions.

The shared parser must preserve the CLI parser's current accepted formats. Determine these from `parseAgentResult`; do not invent a new schema.

Both transports must call the same parser.

## Parser invariant

The parser must classify **only explicit structured artifact output** supported by the CLI baseline.

Plain prose containing OpenSCAD words is not code.

Examples that must NOT produce a build tool-call:

```text
The cube is already centered.
Rotate the part 90 degrees before printing.
I would keep the cylinder as-is.
```

**Acceptance:** fresh checkout contains the CLI adapter and both transport paths can import the same result parser.

---

# R05 — Separate progressive text streaming from final artifact emission

Streaming must have two independent behaviors:

```text
OpenCode events -> progressive visible text
OpenCode terminal result -> shared final-result parser -> optional pCAD tool-call
```

## Rules

1. Accumulate the complete OpenCode assistant result while still yielding visible text deltas normally.
2. Do not call the shared artifact parser on partial fragments.
3. Only after the OpenCode request reaches its verified terminal state, parse the complete final result once.
4. If the result contains a valid SCAD artifact according to the shared parser, emit exactly one `build_parametric_model` tool-call through the correct installed `LanguageModelV2` stream shape.
5. If the final result is ordinary text, do not fabricate a tool-call.
6. If parametric generation required code but the final result has no valid artifact, produce a clear controlled failure/log condition rather than guessing from keywords.

**Acceptance:** prose streams progressively, but artifact detection is final-result-only.

---

# R06 — Add single-emission and revision-loop regression tests

Add deterministic tests before manual model testing.

Required cases:

1. **Prose keyword regression**

```text
The cube looks correct; no rotation is necessary.
```

Expected: zero `build_parametric_model` calls.

2. **Fenced SCAD final result**

Expected: exactly one build call.

3. **CLI-supported JSON final result**

Expected: exactly one build call.

4. **Partial fenced block during stream**

Expected before terminal event: zero build calls.

5. **Completed fence at terminal event**

Expected: exactly one build call.

6. **Repeated/snapshot events carrying the same final content**

Expected: exactly one build call.

7. **Final artifact and terminal event in the same batch**

Expected: artifact is not lost and one build call is emitted.

8. **Follow-up prose after a client tool result containing CAD keywords**

Expected: zero accidental build calls unless a new explicit artifact is returned.

9. **Ordinary final text**

Expected: text response only; no build call.

**Acceptance:** the false-positive path that caused Qwen's infinite revision loop is covered by a failing-before/fixed-after regression test.

---

# R07 — Re-evaluate CLI/Streaming agent semantic parity

Only do this after routing and result parsing are stable.

Compare the actual CLI command and Streaming session configuration:

- model;
- agent;
- working directory;
- OpenCode tools;
- file read/write;
- shell access;
- permissions;
- prompt/system instructions;
- final-result contract.

The current pushed `formatPrompt()` explicitly says not to use tools/files. Do not keep or remove this accidentally.

Choose and document the intended parity behavior.

**Acceptance:** any CLI/Streaming semantic difference is explicit and justified.

---

# R08 — Recovery validation gate

Run the complete relevant suite:

```bash
npm run typecheck
npm run lint
npm run build
```

Run all existing OpenCode/CLI/streaming Node tests plus the new R03/R06 tests.

Then perform one manual test in each mode using the same OpenCode model:

```text
CLI       -> valid model generation
Streaming -> progressive text + exactly one intended build call
```

Also test a prose-only response containing `cube`, `rotate`, and `cylinder` and verify it cannot create a build call.

Only after R08 passes:

- close/reclassify G01;
- continue with G02 permissions;
- then G03 history ownership;
- then optional G04 persistent sessions;
- continue H/I from the main plan.

---

## Recovery definition of done

- [ ] Current G01 WIP preserved before editing.
- [ ] Status agrees with actual code (raw HTTP, not stale SDK decision).
- [ ] Same OpenCode UI model switches between CLI and Streaming by execution mode.
- [ ] `cliAgents.ts` is reproducible from a fresh checkout.
- [ ] CLI and Streaming use one final-result parser.
- [ ] No keyword-based SCAD detection from prose.
- [ ] Artifact parsing only happens after complete final result.
- [ ] Exactly one build tool-call per explicit final artifact.
- [ ] Regression tests cover the former infinite-loop trigger.
- [ ] CLI/Streaming semantic differences are explicitly documented.
- [ ] Full validation passes before resuming G02.

## Prompt for the coding agent during recovery

> Read `docs/opencode_streaming_status.md` first and work only on `Current next task`. For recovery tasks, read only the matching R-task from `docs/opencode_g01_recovery_plan.md`. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Preserve the current uncommitted `src/server/opencode.ts` work and never overwrite/reset/clean local user work or `src/server/cliAgents.ts`. Implement exactly one task, run its focused validation, update the status file with evidence and result, set the next task only if DONE, then stop.
