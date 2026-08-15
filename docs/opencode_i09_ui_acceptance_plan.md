# I09 — OpenCode Transport Selector Acceptance Plan

Created after manual browser testing on 2026-08-15.

This is a focused pre-merge repair plan. **Do not merge to `master` until I09 is complete and manually accepted.**

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
const [executionMode, setExecutionMode] =
  useState<'cli' | 'streaming'>('cli');
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