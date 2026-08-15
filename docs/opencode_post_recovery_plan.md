# OpenCode Post-Recovery Plan

Created after reviewing pushed commit `d942915386a7f303c70cb1678f17a9dd027f9470`.

This plan is intentionally narrow. The G01 parser/tool-call recovery passed, but a post-recovery code review found one remaining stream-protocol defect and a permissions assumption that must be corrected before continuing to G03/history and H/concurrency.

Status: `docs/opencode_post_recovery_status.md`

## Operating rule

Work on exactly **one task ID per coding-agent run**.

Start every run with:

```bash
git branch --show-current
git status --short
git log -1 --oneline
```

Do not reset, clean, or overwrite unrelated local work.

For OpenCode permission/API behavior, the installed OpenCode version and its `/doc` are authoritative. Public docs are secondary.

---

# S01 — Reproduce the stream lifecycle defect with a failing test

**Audit/test task only. Do not fix runtime code yet.**

## Problem found in pushed code

In `src/server/opencode.ts`, `streamParts()` currently emits `text-end` and `reasoning-end` after **every poll batch** whenever the respective part has started, before checking whether the batch is terminal.

That can create an invalid sequence such as:

```text
poll 1:
  text-start text-1
  text-delta text-1 "Hello"
  text-end text-1

poll 2:
  text-delta text-1 " world"   <-- delta after end
  text-end text-1              <-- duplicate end

poll 3 terminal:
  text-delta text-1 "!"
  text-end text-1              <-- duplicate end
  finish
```

The existing `opencodeStreamTests.test.ts` does not exercise the real lifecycle state machine; it copies `extractText()` logic into the test file. Therefore the current passing tests do not catch this protocol defect.

## Steps

1. Inspect installed `@ai-sdk/provider` LanguageModelV2 stream-part contract.
2. Add a focused failing test that models at least three OpenCode poll batches.
3. Assert:
   - exactly one `text-start`;
   - zero `text-end` before terminal batch;
   - all text deltas use the same active ID;
   - exactly one `text-end` at terminal completion;
   - no delta occurs after `text-end`.
4. Add equivalent reasoning assertions if reasoning is started.
5. Do not modify `streamParts()` in S01.

**Acceptance:** test fails against the current pushed implementation for the expected lifecycle reason.

---

# S02 — Extract a testable OpenCode event-to-stream state machine

Avoid another test that copies production logic.

## Goal

Move the event-batch lifecycle logic used by `streamParts()` behind a small production helper/state object that tests can call directly.

Conceptually:

```text
state + OpenCode event batch
        |
        v
AI SDK stream parts + updated state + terminal/error signal
```

## Requirements

- Production `streamParts()` must use this same helper.
- Tests import the production helper; no duplicated parser/reducer implementation.
- State owns:
  - cursor;
  - active text part ID;
  - active reasoning part ID;
  - whether each part is open/closed;
  - accumulated/yielded text if still needed;
  - captured usage;
  - terminal/error status.
- Keep the helper focused on event -> AI SDK parts. Do not refactor HTTP/session code unnecessarily.

**Acceptance:** S01 test exercises the same lifecycle code used at runtime.

---

# S03 — Fix terminal-only part closing and error lifecycle

Using the S01/S02 tests, implement the smallest correction.

## Normal completion invariant

Across any number of polls:

```text
stream-start
text-start?       exactly once if text exists
text-delta*       zero or more, never after text-end
reasoning-start?  exactly once if reasoning exists
reasoning-delta*  zero or more, never after reasoning-end
text-end?         exactly once, only when the active part is actually complete
reasoning-end?    exactly once, only when the active part is actually complete
finish            exactly once
```

Do not close a part merely because one HTTP poll response ended.

## Error invariant

Verify the installed AI SDK V2 contract and choose the supported sequence. If an error terminates a started part, close any open text/reasoning parts before the terminal error/finish behavior if required by that contract. Do not silently leave UI parts permanently in `streaming` state.

## Regression cases

- text across 3 nonterminal/terminal poll batches;
- reasoning across multiple polls;
- text + reasoning interleaving;
- terminal event and final text in same batch;
- terminal event before final text in same batch;
- step.failed after text has started;
- empty response.

**Acceptance:** lifecycle tests pass and no production delta is emitted after its corresponding end part.

---

# S04 — Validate the repaired stream against a real OpenCode response

Run the focused automated suite first, then one real longer Streaming request that produces multiple polling batches.

Record:

- observed number/order of `text-start`, `text-delta`, `text-end`, `finish`;
- same for reasoning if emitted;
- progressive UI still works;
- G01 final artifact conversion still emits exactly one `build_parametric_model` call;
- prose false-positive regression remains zero tool-calls.

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

and all relevant OpenCode tests.

**Acceptance:** stream lifecycle is valid in automated and real-model evidence without regressing G01.

---

# G02A — Audit actual OpenCode permission behavior

Do not trust prompt text as a security control.

The current code says "do NOT call tools" in natural-language prompts, but that does **not** disable OpenCode tools or permissions by itself.

Also, the CLI path currently uses:

```text
opencode run --auto ...
```

Current public OpenCode documentation says `--auto` automatically approves permission requests that would otherwise ask, while explicit `deny` rules remain enforced. Verify this against installed OpenCode `1.18.18` / installed help/config before changing code.

## Audit

Without recording secrets, inspect:

- installed `opencode --version`;
- `opencode run --help`;
- server `/doc` permission-related events/endpoints;
- repository OpenCode config if present;
- user/global OpenCode permission config relevant to the run;
- `OPENCODE_PERMISSION` or equivalent environment support in the installed version;
- whether the running pCAD OpenCode server was started by `start.sh` or reused from an already-running external process;
- which tools are actually available to the CLI run;
- which tools are actually available to the Streaming session;
- what happens when a permission resolves to `ask` in each noninteractive path.

## Required correction to earlier documentation

Do not describe tools as "disabled" merely because the prompt asks the model not to use them.

**Acceptance:** status contains an evidence-based permission matrix for CLI and Streaming.

---

# G02B — Choose the pCAD OpenCode security policy

Use the product intent documented in R07 as the starting point: pCAD currently wants OpenCode to return an artifact, not independently edit the repository or run arbitrary shell/network operations.

Choose an **enforced** policy, not a prompt-only policy.

Preferred security property unless evidence/product requirements say otherwise:

```text
pCAD OpenCode transport:
  no file edits
  no shell execution
  no arbitrary external-directory access
  no web/network tool use
  no subagents/MCP side effects
  no interactive permission deadlock
```

Questions to resolve:

1. Can the installed prompt/session API disable tools per request/session? Prefer this because pCAD may connect to an already-running OpenCode server with unrelated global configuration.
2. If per-request enforcement is unavailable, can pCAD create/use a dedicated agent with explicit `deny` permissions?
3. If process-level `OPENCODE_PERMISSION` is required, how do we guarantee the connected server is the pCAD-restricted instance rather than a reused permissive server?
4. Should `--auto` remain on the CLI path once an explicit deny policy exists? It must never broaden a pCAD deny policy.

Record one policy before implementation.

**Acceptance:** one explicit CLI + Streaming permission policy is documented, with enforcement point(s) identified.

---

# G02C — Enforce CLI permissions

Implement the G02B policy for `opencode run`.

Requirements:

- Use installed-version-supported permission configuration.
- Explicit deny must win over `--auto` or remove `--auto` if it is no longer required.
- Do not modify the user's global OpenCode configuration as a side effect.
- Do not rely only on the appended natural-language instruction.
- Preserve model invocation and shared final-result parser behavior.

## Test

Use a harmless prompt designed to tempt/request a tool action and verify:

- no shell command executes;
- no file is created/edited/read outside allowed behavior;
- no permission request hangs the CLI process;
- the model can still return an ordinary artifact/text result.

**Acceptance:** CLI security is enforced by configuration/API, not model compliance.

---

# G02D — Enforce Streaming permissions

Implement the same effective policy for HTTP Streaming.

Prefer request/session-level enforcement if supported by installed `/doc`, because `start.sh` can reuse an already-running OpenCode server.

If the installed API cannot enforce the policy per session:

- document that limitation;
- use a dedicated pCAD server configuration/process;
- make the health/connection path verify that pCAD is not silently reusing an unknown permissive server.

Do not auto-answer permission requests with `once`/`always` merely to make the request finish.

**Acceptance:** Streaming cannot gain more filesystem/shell/network authority than the chosen pCAD policy.

---

# G02E — Handle permission events deterministically

Even under a deny policy, make permission-related behavior observable and non-hanging.

- Identify installed event type(s) for permission requests/denials.
- Detect unexpected permission requests during Streaming.
- Surface/log a concise controlled error or status rather than polling forever.
- Do not send approval unless the chosen G02B policy explicitly includes user approval and the UI actually implements that interaction.
- If explicit deny produces a normal tool-denied result rather than a request event, test that path instead.

**Acceptance:** no permission-related event can leave the pCAD request stuck indefinitely.

---

# G02F — Permission regression tests

Automated tests must not execute dangerous commands.

At minimum cover:

- CLI child gets the intended permission environment/config;
- explicit deny is not overridden by CLI auto mode;
- Streaming request/session includes the intended enforcement when supported;
- unexpected permission request becomes deterministic state/error, not an infinite poll;
- no permission response endpoint is called automatically under deny policy;
- existing G01 parser/tool-call tests still pass.

Use mocks for HTTP/process behavior where possible.

---

# G02G — Full permission validation gate

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Run all OpenCode tests.

Perform harmless live CLI + Streaming permission probes against the installed OpenCode version. Never use destructive commands for validation.

Update the main status only after this gate passes:

```text
G01 = DONE
G02 = DONE
Current next task = G03
```

Then resume `docs/opencode_streaming_plan.md` at G03 history ownership.

---

## Definition of Done for this post-recovery plan

- [ ] AI SDK text/reasoning lifecycle closes parts only at real terminal boundaries.
- [ ] Tests exercise production lifecycle logic rather than copied test-only logic.
- [ ] G01 exact-one tool-call and prose false-positive fixes remain green.
- [ ] Actual OpenCode permissions are audited rather than inferred from prompt wording.
- [ ] CLI and Streaming use an explicit enforced pCAD permission policy.
- [ ] `--auto` cannot broaden explicit pCAD restrictions.
- [ ] Reusing an already-running Streaming server cannot silently bypass the chosen permission policy.
- [ ] Permission requests cannot hang the pCAD stream indefinitely.
- [ ] G02 is marked DONE only after automated + harmless live validation.
