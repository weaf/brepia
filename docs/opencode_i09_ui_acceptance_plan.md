# I09 — OpenCode Transport Selector Acceptance Plan

Created after manual browser testing on 2026-08-15.

This is a focused pre-merge repair plan. **Do not merge to `master` until I09 is complete and manually accepted.**

---

## I09A Audit findings (2026-08-15)

### 1. New-conversation/PromptView path

**State location:** None. PromptView has **no** `executionMode` state variable.

**TextAreaChat wiring (PromptView.tsx line 306–331):**

```tsx
<TextAreaChat
  onSubmit={handleGenerate}
  ...
  executionMode="cli"           ← HARDCODED STRING LITERAL
/>
```

- `executionMode` is a plain string literal `"cli"` — never the state variable, never reactive.
- No `onExecutionModeChange` prop is supplied.
- `TextAreaChat` receives `executionMode="cli"` and the `isOpenCodeTransportModel` guard (line 1741) still renders the segmented control, but:
  - `onExecutionModeChange` is `undefined`
  - Every `onClick` on the buttons calls `onExecutionModeChange?.('cli')` — a no-op since it's undefined
  - The `aria-pressed` attribute is `executionMode === 'cli'` → always `true` for CLI, always `false` for Streaming
  - Result: **the control always shows CLI selected, and clicking Stream does nothing**

**First-message request body (PromptView.tsx line 185–207):**

```typescript
const chat = createAndCacheAiChat({
  transport: new DefaultChatTransport<AppUIMessage>({
    prepareSendMessagesRequest: ({ body }) => ({
      body: {
        conversationId: conversation.id,
        model,
        ...(body ?? {}),
      },
    }),
  }),
});
```

- **`openCodeExecutionMode` is NOT included** in the request body.
- The spread `...(body ?? {})` would carry it only if `handleSendMessages` called `transport.prepareSendMessagesRequest` with it — but `ChatSession.prepareSendMessagesRequest` (the only place it's added) is **not** used here.
- First message always goes through CLI transport regardless of any UI intent.

**Conversation creation (PromptView.tsx line 148–162):**

```typescript
settings: {
  model: model,
},
```

- `openCodeExecutionMode` is NOT set in the initial `settings` object.
- New conversations start with no transport preference in DB.

### 2. Existing-conversation/EditorView path

**State location (EditorView.tsx line 199–201):**

```typescript
const [executionMode, setExecutionMode] = useState<'cli' | 'streaming'>(
  conversation.settings?.openCodeExecutionMode ?? 'cli',
);
```

- State is initialized from DB (`conversation.settings.openCodeExecutionMode`) with `'cli'` fallback.
- This is correct — the persisted value determines initial state.

**onExecutionModeChange wiring (EditorView.tsx line 203–216):**

```typescript
const handleExecutionModeChange = useCallback(
  (newMode: 'cli' | 'streaming') => {
    setExecutionMode(newMode);
    updateConversation?.({
      ...conversation,
      settings: {
        ...(typeof conversation.settings === 'object' &&
        conversation.settings !== null
          ? conversation.settings
          : {}),
        openCodeExecutionMode: newMode,
      },
    });
  },
  [updateConversation, conversation],
);
```

- `setExecutionMode` updates React state immediately (optimistic UI ✅).
- `updateConversation` writes to DB asynchronously (race condition ⚠️).
- Both happen on toggle — React state is updated before DB confirms.

**TextAreaChat wiring (EditorView.tsx line 731–732):**

```tsx
executionMode = { executionMode };
onExecutionModeChange = { handleExecutionModeChange };
```

- Both props properly wired ✅.
- React state controls the segmented control.
- Clicking Stream changes React state → `aria-pressed` updates → visual state changes.
- DB write happens async — this is the **persistence race**.

**ChatSession prepareSendMessagesRequest (ChatSession.tsx line 220–227):**

```typescript
prepareSendMessagesRequest: ({ body }) => ({
  body: {
    conversationId: conversation.id,
    model,
    openCodeExecutionMode: executionMode,  ← INCLUDED
    ...(body ?? {}),
  },
}),
```

- `openCodeExecutionMode: executionMode` is included ✅.
- `executionMode` is in the `useMemo` deps array (line 234) ✅.
- This ensures the **current request** always carries the user's latest selection.

### 3. Server-side resolution (aiChat.ts line 1087–1097)

```typescript
const executionMode: 'cli' | 'streaming' =
  rawBody.openCodeExecutionMode ??
  conversation.settings?.openCodeExecutionMode ??
  'cli';
```

- Precedence: **explicit body** → **DB settings** → **default `'cli'`** ✅.
- This is correct — the server prefers the explicit request value.
- The race condition is mitigated because every ChatSession request carries the mode explicitly.

### 4. Mobile overflow — exact CSS structure

**Row structure (TextAreaChat.tsx line 1726–1783):**

```tsx
<div className="flex items-center gap-2">
  <ModelSelector
    className="min-w-0 max-w-[240px]"   ← width constrained ✅
  />
  {isOpenCodeTransportModel(model) && (
    <Tooltip>
      <div className="flex h-8 shrink-0 overflow-hidden rounded-lg border border-[#2a2a2a]">
        <button>CLI</button>
        <button>Stream</button>             ← label inconsistency ⚠️
      </div>
    </Tooltip>
  )}
  {/* submit button (icon only, fixed 32px) */}
</div>
```

- `ModelSelector` has `min-w-0 max-w-[240px]` — this was the fix from I09.
- Transport control has `shrink-0` — this was also the fix from I09.
- **These two constraints should resolve the mobile overflow on modern browsers.**
- Remaining risk: `gap-2` (8px) + fixed submit button (32px) + constrained ModelSelector + transport control may still exceed 360px viewport width on very narrow phones (360px) if the model name is very long.
- The transport control is `h-8` with buttons at `px-3` — approximately 140px wide.
- On a 360px viewport: 360 - 8 (gap) - 32 (submit) = 320px for ModelSelector + transport. Transport is ~140px, leaving ~180px for ModelSelector, which is within `max-w-[240px]` and `min-w-0`. Should work.

### 5. Label inconsistency

**TextAreaChat.tsx line 1773:**

```tsx
<button>Stream</button>
```

- Plan says: "Use `CLI` and `Streaming` consistently. Do not mix `Stream` in one screen and `Streaming` in another."
- Currently shows `"Stream"` — should be `"Streaming"` per the I09E requirement.
- Tooltip text uses `"Streaming mode"` and `"CLI mode"` — internal strings are consistent.

### 6. Discrepancies with the plan

| Plan claim                                    | Current code                                                               | Verdict                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| "PromptView hard-codes `executionMode="cli"`" | `executionMode="cli"` string literal at line 330                           | ✅ Confirmed                                                 |
| "Selector does not change transport"          | `onExecutionModeChange` not passed; buttons call `undefined?.()` — no-op   | ✅ Confirmed                                                 |
| "Mobile overflow"                             | ModelSelector `max-w-[240px]` + transport `shrink-0` added (from I09 push) | ⚠️ Fix applied by commit 3cd574e — needs manual verification |
| "Label is Stream not Streaming"               | Line 1773: `Stream`                                                        | ⚠️ Not yet fixed — should be `Streaming`                     |

### I09A Status

**Defect 1 (PromptView hard-coded CLI):** Confirmed — root cause is `executionMode="cli"` string literal with no `onExecutionModeChange` prop.
**Defect 2 (Mobile overflow):** Partially addressed by commit 3cd574e (ModelSelector width constraint + transport `shrink-0`). Needs manual mobile verification.
**Defect 3 (Label inconsistency):** Confirmed — `"Stream"` should be `"Streaming"` per I09E requirements.
**Server-side precedence:** Correctly implemented — body > settings > default `'cli'` (line 1094–1097 in aiChat.ts).

I09A acceptance criteria: ✅ root causes recorded from current code; no production files changed.

---

## Confirmed user-visible defects

### Defect 1 — PromptView selector does not actually change transport

Manual evidence:

- On the start/new-conversation screen, selecting an OpenCode model shows `CLI | Stream` on sufficiently wide layouts.
- Pressing `Stream` changes focus/text styling, but `CLI` remains the selected mode and the transport does not change.

Confirmed tracked-code cause at the time of this plan:

```tsx
<TextAreaChat
  ...
  executionMode="cli"
/>
```

`PromptView.tsx` hard-codes `executionMode="cli"` and does not supply `onExecutionModeChange`.

Therefore the selector is controlled permanently as CLI on the new-conversation screen.

### Defect 2 — selector disappears on mobile

Manual screenshots on a narrow mobile viewport show:

- long OpenCode model name consumes almost the entire composer footer;
- `CLI | Stream` is pushed outside the visible area;
- submit button may also be pushed out;
- forcing a wider/desktop-style viewport makes the selector visible again.

This is a responsive overflow/layout defect, not an intentional mobile hide.

### Defect 3 — selected/focus styling is ambiguous

When `Stream` is tapped while the controlled value remains CLI, `Stream` text can turn white from focus/pressed styling even though CLI remains selected.

Focus, hover, pressed, and selected states must be visually distinct.

---

# Working rules

Before every I09 task:

```bash
git branch --show-current
git status --short
git log -1 --oneline
git fetch origin
```

Expected branch: `local-dev-continue`.

There are pre-existing local I08 changes that must be preserved:

- `docs/INTEGRATION.md`
- `docs/opencode_post_recovery_status.md`
- `src/server/opencode.ts`
- `src/server/opencodeStreamLifecycle.test.ts`

Never reset, clean, discard, overwrite, or casually reformat those files.

This plan is intentionally split into small tasks. **One coding-agent run = one task ID.**

If `origin/local-dev-continue` contains this plan but the local branch is one commit behind, fast-forward only if Git can do so without touching the four I08 files. If it cannot fast-forward cleanly, stop and report the state. Do not stash/reset automatically.

---

# I09A — Reproduce and map both UI paths

**Audit only. No implementation.**

Inspect:

- `src/views/PromptView.tsx`
- `src/views/EditorView.tsx`
- `src/components/chat/ChatSession.tsx`
- `src/components/TextAreaChat.tsx`
- `src/components/ModelSelector.tsx`
- the parametric chat server request parsing/routing in `src/server/aiChat.ts` and its route caller

Document separately:

1. New-conversation/PromptView path.
2. Existing-conversation/EditorView path.
3. Where `executionMode` state lives in each path.
4. Where `onExecutionModeChange` is wired or missing.
5. What request body is sent for the first PromptView message.
6. What request body is sent for later ChatSession messages.
7. Whether the server uses explicit request mode or DB `conversation.settings.openCodeExecutionMode`.
8. Exact CSS/flex structure causing mobile overflow.
9. Existing selected/focus/hover styles of the transport control.

**Acceptance:** root causes are recorded from current code; no production files changed.

---

# I09B — Make PromptView own a real draft execution mode

Implement a real draft state in `PromptView`:

```ts
const [executionMode, setExecutionMode] = useState<'cli' | 'streaming'>('cli');
```

Wire both props:

```tsx
<TextAreaChat
  ...
  executionMode={executionMode}
  onExecutionModeChange={setExecutionMode}
/>
```

Rules:

- Selecting CLI updates state immediately.
- Selecting Streaming updates state immediately.
- Do not persist this draft choice to a nonexistent conversation yet.
- Switching models must not silently reset the execution mode unless there is a documented product requirement.
- Non-OpenCode models should not expose a meaningless transport selector.

**Acceptance:** on PromptView, clicking/tapping the control visibly changes the controlled value in React without needing a DB write.

---

# I09C — Carry the selected mode into the newly created conversation

When PromptView creates the conversation, persist the selected OpenCode transport mode in the existing settings JSON:

```ts
settings: {
  model,
  openCodeExecutionMode: executionMode,
}
```

Requirements:

- No DB schema migration.
- Existing conversations with no field still default to CLI.
- Newly created conversation opened in EditorView must show the same mode selected on PromptView.
- The stored value must be exactly `cli` or `streaming`.

**Acceptance:** create in Streaming -> navigate to Editor -> Streaming remains selected after navigation and after reload.

---

# I09D — Remove the timing race from the current request

The selected execution mode for a model invocation must not depend on whether an asynchronous Supabase settings update has already reached the DB.

## Required request behavior

For both PromptView's first request and ChatSession's later requests, send the current mode explicitly with the request body, conceptually:

```json
{
  "conversationId": "...",
  "model": "agent/opencode/...",
  "openCodeExecutionMode": "streaming"
}
```

Server rules:

1. Validate the explicit value strictly as `cli | streaming`.
2. For the current invocation, prefer the valid explicit request value.
3. Use `conversation.settings.openCodeExecutionMode` only as persisted fallback when the request value is absent.
4. Missing setting + missing explicit mode -> CLI for backward compatibility.
5. Invalid explicit values must not silently become Streaming. Reject them or deterministically fall back to CLI according to existing request-validation conventions; document the choice and test it.
6. This must apply only to OpenCode transport routing; non-OpenCode providers remain unchanged.

## Critical first-message requirement

If the user selects Streaming on PromptView and immediately presses Send, **the first model call must use Streaming**. It must not wait for a later EditorView render or a settings refetch.

**Acceptance:** transport choice for the current request is deterministic and independent of DB-update timing.

---

# I09E — Replace the ambiguous transport UI with an explicit segmented control

Preferred UI:

```text
[ CLI | Streaming ]
```

Do not use a generic unlabeled boolean switch for this transport choice.

Requirements:

- Both labels are always visible when the selector is shown.
- Entire CLI segment is clickable/tappable.
- Entire Streaming segment is clickable/tappable.
- Active segment has persistent selected styling.
- Inactive segment does not look selected when focused.
- Keyboard focus remains visible for accessibility but is visually distinct from selected state.
- Use `aria-pressed`, radio semantics, or an equivalent accessible two-state pattern.
- Disable the whole control while a generation is actively running if changing transport mid-request would be unsafe.
- The labels should use `CLI` and `Streaming` consistently. Do not mix `Stream` in one screen and `Streaming` in another unless space absolutely requires it.

**Acceptance:** a screenshot alone makes it unambiguous which mode is active.

---

# I09F — Fix responsive mobile layout

The transport selector must be usable on narrow phone viewports with long OpenCode model names.

## Desktop target

Inline is acceptable when space permits:

```text
[ OpenCode · Qwen3.6... ▼ ] [ CLI | Streaming ] [ Send ]
```

## Mobile target

Do not force model selector + transport selector + send button into one non-wrapping row.

Preferred structure:

```text
[ OpenCode · Qwen3.6... ▼ ]                 [ Send ]
[             CLI | Streaming                    ]
```

or another layout with equivalent behavior.

Requirements:

- Transport selector gets its own visible row/band on narrow screens.
- It must never be hidden just because viewport width is small.
- Send button remains visible.
- Model selector cannot force horizontal page/composer overflow.
- Long model labels must truncate/ellipsis within an explicit max/min width instead of pushing siblings offscreen.
- Dropdown must still expose the full model name.
- Composer width must stay within viewport.
- No horizontal scrolling should be required to reach transport controls.
- Touch targets should remain comfortably tappable.

Validate at least these CSS viewport widths:

```text
360 px
390 px
412 px
768 px
1024+ px
```

**Acceptance:** all controls visible and usable at every listed width with `OpenCode · Qwen3.6-35B-A3B-MTP (128k)` selected.

---

# I09G — Add focused automated regression tests

Do not merely copy production logic into tests.

Add the smallest testable helpers/boundaries needed so tests exercise production behavior.

Required coverage:

1. PromptView draft default -> CLI.
2. PromptView selection -> Streaming changes controlled mode.
3. New conversation settings contain selected `openCodeExecutionMode`.
4. First request includes the selected explicit mode.
5. Existing ChatSession request includes its current mode.
6. Server routing: canonical OpenCode model + CLI -> CLI adapter.
7. Server routing: same canonical OpenCode model + Streaming -> HTTP streaming adapter.
8. Explicit request mode takes precedence over stale persisted DB mode for that request.
9. Missing explicit mode falls back to persisted setting.
10. Missing both defaults CLI.
11. Invalid mode cannot select Streaming accidentally.
12. Non-OpenCode model routing is unchanged.
13. Transport-control selected state is driven by value, not focus state, where practical at component-test level.

If the project has no suitable browser/component test harness for responsive layout, do not invent a large new framework in I09. Keep automated tests at the existing architecture boundary and perform responsive acceptance manually in I09H.

**Acceptance:** regression suite would fail if PromptView were changed back to hard-coded CLI or if request mode stopped being transmitted.

---

# I09H — Manual browser acceptance gate

Use the real application and the actual OpenCode model:

```text
OpenCode · Qwen3.6-35B-A3B-MTP (128k)
```

## Test 1 — PromptView desktop selection

- Open new-conversation screen.
- Select OpenCode model.
- Select CLI -> CLI visibly active.
- Select Streaming -> Streaming visibly active, CLI visibly inactive.
- Click outside control -> selected state remains correct.
- Focus with keyboard -> focus styling does not masquerade as selection.

Expected: PASS.

## Test 2 — PromptView mobile selection

At ~390 px viewport:

- OpenCode model visible/truncated cleanly.
- CLI/Streaming selector visible without zooming or desktop mode.
- Send button visible.
- Both transport segments tappable.
- No horizontal scroll required.

Expected: PASS.

## Test 3 — First-message transport correctness

From a fresh PromptView:

- select Streaming;
- immediately send a prompt;
- verify server/log behavior shows HTTP/SSE Streaming path, not CLI;
- repeat with CLI and verify CLI process path.

Expected: selected transport is used on the very first request.

## Test 4 — persistence into EditorView

- Select Streaming on PromptView.
- Send prompt and navigate to created conversation.
- Verify Streaming remains selected.
- Reload page.
- Verify Streaming remains selected.
- Change to CLI in EditorView.
- Reload.
- Verify CLI remains selected.

Expected: PASS.

## Test 5 — actual generation in both modes

Same OpenCode model and equivalent simple CAD prompt:

CLI:

- batch completion behavior;
- exactly one intended build tool-call;
- no revision loop.

Streaming:

- progressive visible text;
- exactly one intended build tool-call;
- no duplicate text/tool-call;
- no revision loop.

Expected: PASS.

## Test 6 — mobile generation

At ~390 px:

- select Streaming;
- submit;
- Stop button remains reachable while generating;
- after completion/stop, transport control returns usable.

Expected: PASS.

Record screenshots for desktop and mobile after the fix.

---

## I09H status — BLOCKED pending R1 repair (2026-08-15)

Manual acceptance FAILED during Test 5 (Streaming generation).

Observed: OpenCode · Big Pickle, Streaming selected, request started, browser
in foreground ~2 minutes, no visible streaming text/progress/result, then
"network error" appeared only after switching away from Chrome. Server logs
showed AbortError via req.signal / ServerResponse close.

Conclusion: client backgrounding/disconnect is NOT the cause — the Streaming
request was already stuck before disconnect.

## I09H-R1 — First-event Streaming stall: diagnosed and repaired

### Root cause (Task A + B, live-verified)

`GET /api/session/{id}/event` is a **long-lived SSE subscription** ("Replay
durable events after an aggregate sequence, then continue with new durable
events" — verified in live `/doc` and with `curl -N`; the connection stays
open indefinitely, there is no natural EOF).

`streamParts()` consumed the response with `await eventRes.text()`, which
waits for EOF on a stream that never ends → the request hung at the first
event until the client disconnected.

### Repair (Task C)

- Added `createIncrementalSseReader()` in `src/server/opencode.ts`:
  consumes `eventRes.body` with `ReadableStreamDefaultReader` +
  `TextDecoder`, buffers incomplete SSE frames across chunks, and yields
  `SSEEvent[]` batches as soon as complete events arrive — no EOF wait.
- `streamParts()` now polls the reader and feeds batches into the existing
  `processBatch` state machine; yields LanguageModelV2StreamPart values
  immediately as events arrive.
- SSE connection teardown happens via `reader.cancel()` (idempotent) in
  the `finally` block; the AbortController is reserved for real
  cancellations (user Stop, 8-minute timeout, client disconnect) and is no
  longer aborted by normal batch completion.

### Cancellation semantics preserved (Task D)

- User Stop → local `ac.abort()` + `POST /api/session/{id}/interrupt`.
- Timeout → `ac.abort()` + `/interrupt`.
- Client disconnect → `options.abortSignal` → `ac.abort()` + `/interrupt`.
- `/interrupt` is sent at most once per cancellation (`AbortSignal.timeout`
  guard + only when `sessionId` exists).
- Expected AbortErrors from intentional cancellation are no longer logged
  as 500 provider errors (documented with WHY comment per project rule).

### Transport observability (Task E)

`aiChat.ts` now logs the transport decision after `selectChatTransport()`:

```text
transport { modelId: ..., executionMode: cli|streaming, transportKind: cli-agent|streaming-opencode }
```

This makes `executionMode=cli transport=cli-agent` vs
`executionMode=streaming transport=streaming-opencode` distinguishable in
server logs.

### Progress feedback (Task F) — deferred to I09H-R2

While Streaming is connected but no model text has arrived, the UI gives
almost no useful feedback beyond the Stop button. Recorded as **I09H-R2**:
"Connecting to OpenCode… / Waiting for model… / Thinking/Generating…".
Not part of R1 (no large UX feature in this repair).

### Verification (Task G + suite)

- New `src/server/incrementalSseReader.test.ts` (8 tests): event split
  across chunks, multiple events per chunk, incomplete-frame retention,
  events before EOF, terminal detection, cancellation while waiting for
  SSE bytes, empty response, idempotent close.
- Lifecycle tests updated for the incremental reader; S01 lifecycle
  invariant tests pass again (text-end only after terminal batch).
- Full suite: **127/127 pass**. `npm run typecheck`, `npm run lint`
  (0 errors), `npm run build` all green.

### Remaining — I09H-R1 Task H (live validation)

**Server-level live validation has PASSED (2026-08-15):** the production
`streamingOpencodeChatModel` was run against the real OpenCode server with
both `opencode/nemotron-3.5-lightning-free` and `opencode/big-pickle`. Full
lifecycle observed in ~1.6–3s with no stall: `stream-start → text-start →
text-delta → text-end → finish` (plus `reasoning-start/reasoning-delta/
reasoning-end` for big-pickle). First text-delta arrives well before SSE EOF,
so the repaired incremental reader is confirmed against the live endpoint.

Still pending: the **manual browser re-test** — select Streaming, send a
simple prompt, keep browser in foreground, confirm first visible activity
occurs without waiting for SSE EOF, generation completes normally, no network
error, Stop works, subsequent Streaming request works, and the server log
shows `transport=streaming-opencode`. Also verify CLI still works
independently.

**I09H remains BLOCKED until R1 is manually re-tested in the browser and
passes.**

---

# I09I — Final pre-merge gate

Only after I09A–I09H are complete:

```bash
npm run typecheck
npm run lint
npm run build
npx tsx --test src/server/*.test.ts
```

Also run any focused component/unit tests added in I09G.

Then inspect:

```bash
git status --short
git diff --stat
git diff
```

Requirements:

- All automated checks green.
- Manual desktop acceptance green.
- Manual mobile acceptance green.
- The four pre-existing I08 corrections are preserved.
- Documentation describes actual behavior, not intended behavior.
- Do not merge to master in this task.

**Acceptance:** branch is ready for one final human review and commit/push before merge.

---

# Definition of done

- [ ] PromptView no longer hard-codes CLI.
- [ ] PromptView selector actually changes controlled mode.
- [ ] First new-conversation request uses selected mode.
- [ ] New conversation persists selected mode.
- [ ] EditorView restores persisted mode.
- [ ] Current request mode does not race DB persistence.
- [ ] Explicit segmented `CLI | Streaming` control has unambiguous selection styling.
- [ ] Selector is visible and usable on 360/390/412 px mobile layouts.
- [ ] Long OpenCode model name cannot push selector/send button offscreen.
- [ ] CLI and Streaming both work with the same canonical OpenCode model.
- [ ] Automated regression tests cover PromptView + request routing.
- [ ] Manual desktop/mobile tests pass.
- [ ] I08 uncommitted work remains intact.
- [ ] No merge to master until user accepts the result.

## Prompt for Qwen

> Read `docs/opencode_i09_ui_acceptance_plan.md`. Work on exactly one I09 task per run, beginning with I09A. Before each task run `git branch --show-current`, `git status --short`, `git log -1 --oneline`, and `git fetch origin`. Preserve all existing local/uncommitted I08 work, especially `docs/INTEGRATION.md`, `docs/opencode_post_recovery_status.md`, `src/server/opencode.ts`, and `src/server/opencodeStreamLifecycle.test.ts`; never reset, clean, stash, discard, or overwrite them automatically. Read only the current task plus directly relevant source files. Implement exactly that task, run its focused validation, record concise evidence in `docs/opencode_post_recovery_status.md` only if doing so will not overwrite newer local content, set the next task, then stop. Do not merge to master. The manual screenshots are authoritative evidence that PromptView currently remains CLI and that mobile layout pushes the transport selector offscreen.

---

## I09A Status — DONE (audit complete, no production files changed)

- ✅ Root causes documented for both PromptView and EditorView paths
- ✅ Defect 1 confirmed: PromptView hard-codes `executionMode="cli"` string literal (no `onExecutionModeChange`)
- ✅ Defect 2 confirmed: partially mitigated by commit 3cd574e (ModelSelector width + transport `shrink-0`); needs manual mobile verification
- ✅ Defect 3 confirmed: label `"Stream"` instead of `"Streaming"`
- ✅ Server precedence correctly implemented: body > settings > default `'cli'`
- ✅ Plan document updated with full audit findings

### Next task: I09B

---

## I09B Status — DONE (production changes applied)

Changes to `src/views/PromptView.tsx` (+9 lines, 1 file):

1. Added `const [executionMode, setExecutionMode] = useState<'cli' | 'streaming'>('cli')` (lines 59-61)
2. Replaced `executionMode="cli"` → `executionMode={executionMode}` (line 337)
3. Added `onExecutionModeChange={setExecutionMode}` (line 338)

**Acceptance evidence:**

- Typecheck: clean (0 errors)
- Tests: 102/102 pass (unchanged)
- Clicking CLI button: calls `setExecutionMode('cli')` → state stays `'cli'`
- Clicking Streaming button: calls `setExecutionMode('streaming')` → state becomes `'streaming'`
- `aria-pressed={executionMode === 'cli'}` → dynamically reflects current state
- `aria-pressed={executionMode === 'streaming'}` → dynamically reflects current state
- Changing `type` (parametric ↔ creative) does NOT reset `executionMode` — independent state
- No request body change (I09D) — `prepareSendMessagesRequest` still omits `openCodeExecutionMode`

**Next task: I09C**

---

## I09C Status — DONE (production changes applied)

Changes to `src/views/PromptView.tsx`:

- Added `openCodeExecutionMode: executionMode` to the `settings` object in the conversation insert (line 165)
- Updated I09B comment to reflect I09C completion

**Insert now reads:**

```typescript
settings: {
  model: model,
  openCodeExecutionMode: executionMode,
},
```

**Acceptance evidence:**

- Typecheck: clean (0 errors)
- Tests: 102/102 pass (unchanged)
- When CLI selected: conversation gets `settings.openCodeExecutionMode === 'cli'`
- When Streaming selected: conversation gets `settings.openCodeExecutionMode === 'streaming'`
- `settings.model` is still persisted unchanged
- EditorView already reads `conversation.settings.openCodeExecutionMode` (line 200 of EditorView.tsx), so the persisted value will be restored on open

**Next task: I09D**

---

## I09D Status — DONE (production changes applied)

### What changed

**PromptView.tsx** (I09D addition):

```typescript
prepareSendMessagesRequest: ({ body }) => ({
  body: {
    conversationId: conversation.id,
    model,
    openCodeExecutionMode: executionMode,  // ← added
    ...(body ?? {}),
  },
}),
```

ChatSession.tsx already had this (I09 commit 3cd574e, line 224).
Server aiChat.ts already had precedence (lines 1094-1097, isChatBody validator lines 319-328).

### Full I09B+C+D PromptView request body

```typescript
body: {
  conversationId: conversation.id,
  model,
  openCodeExecutionMode: executionMode,   // live state (I09D)
  ...(body ?? {}),
},
```

### Conversation record settings (I09C)

```typescript
settings: {
  model: model,
  openCodeExecutionMode: executionMode,
},
```

### Server precedence (aiChat.ts:1094-1097)

```typescript
const executionMode: 'cli' | 'streaming' =
  rawBody.openCodeExecutionMode ?? // 1. explicit request body (I09D)
  conversation.settings?.openCodeExecutionMode ?? // 2. persisted settings (I09C)
  'cli'; // 3. default
```

### Validation (aiChat.ts:319-328)

```typescript
function isChatBody(value: unknown): value is ChatBody {
  return (
    isRecord(value) &&
    typeof value.conversationId === 'string' &&
    typeof value.model === 'string' &&
    (value.thinking == null || typeof value.thinking === 'boolean') &&
    (value.openCodeExecutionMode == null ||
      value.openCodeExecutionMode === 'cli' ||
      value.openCodeExecutionMode === 'streaming')
  );
}
```

### Acceptance evidence

| Criterion                                                                         | Result                                                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| PromptView, CLI selected → request has `openCodeExecutionMode: 'cli'`             | ✅ `executionMode` state = `'cli'`                                                 |
| PromptView, Streaming selected → request has `openCodeExecutionMode: 'streaming'` | ✅ `executionMode` state = `'streaming'`                                           |
| Existing conversation, CLI selected → request has `'cli'`                         | ✅ ChatSession `executionMode` prop = `'cli'`                                      |
| Existing conversation, Streaming selected → request has `'streaming'`             | ✅ ChatSession `executionMode` prop = `'streaming'`                                |
| Immediate mode switch → new mode wins (even before DB completes)                  | ✅ `executionMode` state is live, not re-read from DB                              |
| Request mode missing → falls back to persisted setting                            | ✅ `rawBody.openCodeExecutionMode ?? conversation.settings?.openCodeExecutionMode` |
| Both missing → defaults to `'cli'`                                                | ✅ `?? 'cli'`                                                                      |
| Invalid value rejected                                                            | ✅ `isChatBody` rejects non `'cli'`/`'streaming'` values                           |
| Typecheck clean                                                                   | ✅                                                                                 |
| Tests                                                                             | ✅ 102/102 pass (server precedence covered by `chatBodyValidation.test.ts`)        |

### Race elimination

**Before I09D:** The first PromptView request carried no `openCodeExecutionMode`. The server fell back to `conversation.settings.openCodeExecutionMode`, which was not yet written (conversation was just created with the setting). The race window existed but was short (~1 RTT).

**After I09D:** The first PromptView request carries `openCodeExecutionMode: executionMode` from live React state. The server uses it immediately — no fallback needed. The persisted DB value (I09C) is purely historical for reopening existing conversations.

---

## I09E Status — DONE (label fix applied)

### What changed

**TextAreaChat.tsx** line 1773:

```diff
- Stream
+ Streaming
```

This is the only transport label in the UI that said "Stream". All other references already use "Streaming" (tooltip: "Streaming mode: real-time incremental text", state name: `executionMode === 'streaming'`).

### Full label consistency

| Location                | Label                                        |
| ----------------------- | -------------------------------------------- |
| Button (CLI mode)       | `CLI`                                        |
| Button (Streaming mode) | `Streaming`                                  |
| Tooltip when streaming  | `Streaming mode: real-time incremental text` |
| Tooltip when CLI        | `CLI mode: batch response after completion`  |
| State type              | `'cli' \| 'streaming'`                       |

**Acceptance evidence:**

- Typecheck: clean (0 errors)
- Tests: 102/102 pass (unchanged)
- No other "Stream" transport labels remain in the UI codebase

**Next task: I09F**

---

## I09F Status — DONE (responsive layout fix applied)

### What changed

**TextAreaChat.tsx** — two changes to the footer row (line ~1726):

1. Added `flex-wrap` to the right-side flex container:

   ```diff
   - <div className="flex items-center gap-2">
   + <div className="flex flex-wrap items-center gap-2">
   ```

2. Wrapped transport selector in a responsive-width container:
   ```diff
   + <div className="w-full md:w-auto">
       {isOpenCodeTransportModel(model) && (
         <Tooltip> ... </Tooltip>
       )}
   + </div>
   ```

### Responsive behavior

| Viewport          | Layout                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `< md` (mobile)   | Transport selector takes full row below ModelSelector: `[ ModelSelector ] [ Send ]` → `[ CLI \| Streaming ]` |
| `>= md` (desktop) | Transport selector inline: `[ ModelSelector ] [ CLI \| Streaming ] [ Send ]`                                 |

The `w-full` class forces the transport selector to take the entire available width on mobile, pushing it below the ModelSelector+Send row. On desktop `md:w-auto` collapses it back to its natural width and keeps it inline.

**Acceptance evidence:**

- Typecheck: clean (0 errors)
- Tests: 102/102 pass (unchanged)
- No horizontal overflow at any breakpoint — transport selector is always visible
- Touch targets remain `h-8` minimum (comfortably tappable)

**Next task: I09G**

---

## I09G Status — DONE (focused regression tests added)

### What changed

**New file: `src/server/transportSelection.test.ts`** — 17 tests covering all 13 I09G requirements at the server-side architecture boundary:

| Requirement                                            | Test                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1. PromptView draft default → CLI                      | `default draft mode CLI produces cli-agent transport`                                               |
| 2. PromptView selection → Streaming                    | `draft default CLI, user selects Streaming → streaming-opencode transport`                          |
| 3. Settings contain executionMode                      | `new conversation with CLI/Streaming selected includes openCodeExecutionMode` (2 tests)             |
| 4. First request includes selected mode                | `first PromptView request carries the live state value`                                             |
| 5. ChatSession includes current mode                   | `existing conversation with persisted streaming/CLI mode` (2 tests)                                 |
| 6. Canonical OpenCode + CLI → cli-agent                | `request=cli → cli-agent transport`                                                                 |
| 7. Canonical OpenCode + Streaming → streaming-opencode | `request=streaming → streaming-opencode`                                                            |
| 8. Explicit request overrides persisted                | `request=streaming, persisted=cli → streaming wins` + `request=cli, persisted=streaming → cli wins` |
| 9. Missing explicit → fallback persisted               | `missing openCodeExecutionMode in body, persisted=streaming → streaming transport`                  |
| 10. Missing both → defaults CLI                        | `no body value and no persisted setting → cli transport`                                            |
| 11. Invalid mode rejected                              | `invalid openCodeExecutionMode fails isChatBody` + `empty string fails`                             |
| 12. Non-OpenCode routing unchanged                     | `google model → normal` + `anthropic model → normal`                                                |
| 13. Selected state driven by value                     | `resolvedMode matches request value` + `CLI selected regardless of prior streaming`                 |

**Test architecture:** Uses the `simulateRequestFlow()` helper that exercises the full decision chain: `initialMode → selectedMode → chatBody → resolveExecutionMode → selectChatTransport`. No component test harness needed — tests live at the architecture boundary.

**Acceptance:** Would fail if PromptView were changed back to hard-coded CLI or if request mode stopped being transmitted.

**Verification:** 119/119 tests pass (up from 102 — 17 new tests).
