# I09H-R3 — OpenCode semantic parity repair plan

Created after manual browser testing showed that OpenCode Streaming now transports data correctly but returns prose/reasoning instead of a pCAD model.

**Target branch:** `local-dev-continue`

**Do not merge to `master` until this plan and the remaining I09H acceptance gate are complete.**

## Current live evidence

- Streaming routing works: logs show `transportKind: 'streaming-opencode'`.
- Incremental SSE works after I09H-R1.
- `opencode/big-pickle` and `llama-swap/qwen3.6-35b-mtp-128k` respond, but no model artifact is produced.
- Big Pickle returned normal prose (for example, explaining the intended box).
- Qwen returned reasoning/prose about creating the box, but no final OpenSCAD artifact.
- Codex CLI works as a control and can produce a model.
- The OpenCode Streaming prompt currently tells the model to answer in plain text and to ignore tool instructions, while the final parser only creates a pCAD build when the final result contains structured `{code,message}` JSON or explicit fenced OpenSCAD.
- Ollama/OpenCode CLI exit-code-1 behavior is a separate problem and is explicitly out of scope for R3.

## Execution rule

One task per Qwen run. For every task:

1. Run `git branch --show-current`, `git status --short`, `git log -1 --oneline`.
2. Preserve unrelated work; never reset, clean, stash, discard, rebase, or merge.
3. Read only this plan, the current task, and directly relevant files.
4. Implement exactly the current task.
5. Run the task's focused validation.
6. Update status/docs with concrete evidence only if the task requires it.
7. Set the next task only when the current task is DONE.
8. Stop.

---

# R3A — Audit the exact prompt mismatch

**Goal:** Prove precisely why CLI and Streaming give different semantic behavior before changing production code.

**Primary files:**
- `src/server/opencode.ts`
- `src/server/cliAgents.ts`
- `src/server/opencodeAgentResult.ts`
- `src/server/aiChat.ts`

**Do:**
- Trace the exact prompt sent to OpenCode CLI for a simple CAD request.
- Trace the exact prompt sent to OpenCode Streaming for the same request.
- Trace the Codex CLI prompt as a control.
- Record which CADAM system/context text survives into each path.
- Record each transport-specific instruction added by the adapter.
- Record the final output format expected by `parseAgentResult()` / `finishWithParametricToolCall()`.
- Confirm whether Streaming currently instructs the model to answer in plain text while later expecting structured code.

**Do not:**
- Change production code.
- Fix Ollama.
- Change parser schema.
- Redesign UI.

**Acceptance:** A concise evidence section identifies the exact contradictory instructions and states what a shared semantic contract must preserve.

**Validation:** `npm run typecheck` and existing relevant tests remain green.

**Next:** R3B.

---

# R3B — Create one shared agent output-contract helper

**Goal:** Define one canonical transport bridge for OpenCode/Codex agent results without yet rewiring both transports.

**Primary files:**
- Prefer a small shared server module, or an existing shared agent module if appropriate.
- `src/server/opencodeAgentResult.ts` may be extended only if the responsibility remains coherent.

**Do:**
- Create a small production helper that expresses the canonical final result contract:
  - CAD build/edit/fix request -> complete runnable OpenSCAD in `code`, short user-facing result in `message`.
  - Non-CAD request -> empty `code`, normal answer in `message`.
  - Canonical schema remains exactly `{ "code": "...", "message": "..." }`.
- State that OpenCode's own filesystem/shell/web/external tools must not be used.
- State that pCAD tool semantics are translated into the final JSON artifact; the agent must not attempt to call pCAD's unavailable tools directly.
- Preserve the existing security limitation wording: this is a behavioral instruction, not an enforced sandbox.

**Do not:**
- Change `parseAgentResult()` schema.
- Wire the helper into Streaming yet.
- Wire the helper into CLI yet unless required solely for compilation/testability.
- Add a second independent prompt contract.

**Acceptance:** One production helper exists and tests assert its essential semantic requirements.

**Focused tests:**
- Contract contains `{code,message}` requirement.
- Contract distinguishes CAD and non-CAD output.
- Contract prohibits OpenCode filesystem/shell/web tools.
- Contract does not tell the model to answer CAD requests only as plain text.
- Contract does not tell the model to ignore CADAM CAD semantics wholesale.

**Next:** R3C.

---

# R3C — Make OpenCode CLI use the shared contract

**Goal:** Move the existing working OpenCode CLI behavior onto the shared contract without changing observable CLI semantics.

**Primary files:**
- `src/server/cliAgents.ts`
- shared helper from R3B

**Do:**
- Replace the CLI adapter's inline `{code,message}` instruction with the shared helper.
- Preserve OpenCode CLI invocation flags and permission behavior.
- Preserve Codex behavior unless the shared helper is deliberately used for both agents and tests prove no regression.
- Preserve `parseAgentResult()` and exact-one build emission.

**Do not:**
- Touch Streaming prompt construction yet.
- Change CLI model IDs or subprocess behavior.
- Fix the Ollama exit-code-1 issue.

**Acceptance:** Existing OpenCode CLI CAD output contract is unchanged in behavior but now comes from the shared helper.

**Validation:** Existing CLI/parser tests plus typecheck pass.

**Next:** R3D.

---

# R3D — Make Streaming use the same semantic contract

**Goal:** Remove the semantic contradiction in `formatPrompt()` and make Streaming request the same final artifact format as CLI.

**Primary files:**
- `src/server/opencode.ts`
- shared helper from R3B

**Do:**
- Remove/replace contradictory Streaming instructions such as `Answer the user's request directly in plain text` for CAD work.
- Remove/rephrase the blanket instruction to ignore tool instructions so it no longer destroys CADAM's intended CAD behavior.
- Keep OpenCode-own-tool restrictions separate: no filesystem, shell, web, external tools.
- Preserve relevant CADAM system/modeling context and conversation history.
- Append/use the shared `{code,message}` output contract.
- Explain in the prompt bridge that pCAD will convert final `code` into `build_parametric_model`; OpenCode does not call that pCAD tool itself.

**Do not:**
- Change SSE transport mechanics.
- Change session lifecycle/cancellation.
- Change parser schema.
- Add raw pCAD tool calling to OpenCode.

**Acceptance:** For the same model/conversation, CLI and Streaming receive equivalent CAD/output semantics; only transport mechanics differ.

**Focused tests:**
- Streaming prompt contains the shared output contract.
- CADAM modeling/system context remains present.
- The old plain-text-only contradiction is absent.
- OpenCode-own-tool prohibition remains present.

**Next:** R3E.

---

# R3E — Verify final artifact conversion and exact-once behavior

**Goal:** Ensure structured Streaming output becomes exactly one pCAD build and non-CAD output remains normal text.

**Primary files:**
- `src/server/opencode.ts`
- `src/server/opencodeAgentResult.ts`
- existing parser/lifecycle tests

**Do:**
- Verify complete final JSON with `code` becomes exactly one `build_parametric_model` call.
- Verify fenced OpenSCAD fallback still becomes exactly one build.
- Verify JSON with empty code / normal prose produces zero builds.
- Verify build decision occurs only on the complete terminal result, never partial fragments.
- Inspect whether raw JSON is visibly streamed before terminal conversion; record it as UX follow-up if present.

**Do not:**
- Create a large UI rewrite for streamed JSON.
- Reintroduce revision loops.
- Parse partial fragments for artifacts.

**Acceptance:** Exact-one artifact behavior remains locked and no false-positive build is introduced by R3D.

**Validation:** Focused parser/stream lifecycle tests pass.

**Next:** R3F.

---

# R3F — Add semantic-parity regression tests

**Goal:** Add tests that would have caught the live Big Pickle/Qwen failure.

**Primary area:** server tests only; do not add a large browser-test framework.

**Required coverage:**
1. CLI and Streaming use the same canonical result contract.
2. Streaming CAD prompt does not demand plain-text-only output.
3. Streaming does not blanket-ignore CADAM CAD semantics.
4. CADAM modeling/system context is preserved.
5. OpenCode own tool/file/network prohibition remains.
6. Complete JSON with code -> exactly one build.
7. Fenced OpenSCAD -> exactly one build.
8. Empty-code/non-CAD output -> zero builds.
9. No artifact decision on partial Streaming fragments.
10. Non-OpenCode routing remains unchanged.

**Acceptance:** Tests fail if Streaming is reverted to the old contradictory prompt contract.

**Validation:** `npm run typecheck` and `npx tsx --test src/server/*.test.ts` pass.

**Next:** R3G.

---

# R3G — Live semantic validation against real OpenCode models

**Goal:** Prove the repair works against real OpenCode, not only tests.

**Models:**
- `opencode/big-pickle`
- `llama-swap/qwen3.6-35b-mtp-128k`

**CAD prompt:** `Skapa en enkel låda med botten.`

**Do:**
- Run both through Streaming.
- Confirm log shows `transportKind: 'streaming-opencode'`.
- Confirm final result contains usable OpenSCAD artifact semantics.
- Confirm pCAD creates exactly one build/model.
- Confirm no conversational-only "I can create..." result replaces the model.
- Run non-CAD control: `Förklara kort vad OpenSCAD är. Skapa ingen modell.`
- Confirm non-CAD control returns text and zero builds.

**Do not:**
- Mark I09H complete based only on terminal/server tests; browser acceptance still follows.
- Include Ollama CLI failure in this task.

**Acceptance:** Big Pickle + Qwen CAD cases create models; non-CAD case creates no model.

**Next:** R3H.

---

# R3H — Manual browser re-test and close R3

**Goal:** Re-run the user-facing browser acceptance after semantic repair.

**Do:**
- Test desktop and mobile selector visibility/selection.
- Test first-message Streaming from PromptView.
- Test persistence into EditorView/reload.
- Test real Streaming generation with at least Big Pickle and Qwen.
- Test Stop/cancel and a subsequent request.
- Record screenshots/results.
- Keep I09H BLOCKED if any manual acceptance item still fails.

**Acceptance:** All relevant I09H browser tests pass and a real CAD model appears for Streaming.

**Next:** Continue remaining I09H/I09I merge gate work only after user acceptance.

---

# R3S — Separate sessions-list audit (non-blocking unless it reveals a runtime defect)

**Goal:** Explain why HTTP-created sessions appeared absent from `/sessions` without conflating it with CAD artifact generation.

**Do:**
- Log/record session ID returned by `POST /api/session`.
- Query session/list endpoint on the same running OpenCode server.
- Record server cwd/project scope and whether the `/sessions` view is project-scoped.
- Determine whether sessions persist after completion.

**Do not:**
- Redesign session management unless evidence shows a functional problem.

**Acceptance:** Session visibility behavior is understood and documented.

---

# R4 — Separate OpenCode Ollama CLI invocation failure

**Not part of R3.**

Observed: `agent/opencode/ollama-cloud/gpt-oss:20b` selected CLI and `opencode run` exited 1.

Later task should:
- reproduce the exact `opencode run --format json --pure -m <model-id>` invocation directly;
- capture stdout, stderr, exit code;
- verify exact provider/model ID from `opencode models`;
- determine whether this is provider/model configuration, CLI invocation, or adapter error reporting.

Do not mix R4 changes into R3 semantic parity work.
