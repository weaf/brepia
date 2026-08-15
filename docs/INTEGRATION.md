# pCAD — OpenCode Integration Guide

## Overview

pCAD integrates with [OpenCode](https://opencode.ai/) as a coding agent backend. Two transport paths exist:

| Path          | Module                    | Invocation                                                  | Protocol                |
| ------------- | ------------------------- | ----------------------------------------------------------- | ----------------------- |
| **CLI**       | `src/server/cliAgents.ts` | `opencode run --pure --format json`                         | Stderr → JSON parse     |
| **Streaming** | `src/server/opencode.ts`  | `POST /api/session` → `POST /api/session/{id}/prompt` → SSE | HTTP REST + SSE polling |

Both transports wrap the agent output in an AI SDK `LanguageModelV2` interface and emit a `build_parametric_model` tool-call when the final text contains fenced OpenSCAD code.

---

## CLI vs Streaming

### CLI (`cliAgents.ts`)

- **Invocation**: `opencode run --pure --format json`
- **Stdin**: Prompt is written to stdin via a temporary directory
- **Stdout/stderr**: JSON output goes to stderr (confirmed bug in `opencode run --format json`)
- **Timeout**: 8 minutes (`TIMEOUT_MS = 8 * 60_000`)
- **Permission policy**: `--pure` disables external plugins. `--auto` flag is NOT passed (prevents auto-approval of tool permissions). The prompt instruction ("Do NOT use tools") is the behavioral guard — this is not a hard enforcement.
- **Session model**: No persistent sessions — each call spawns a fresh child process and exits

### Streaming (`opencode.ts`)

- **Invocation**: Full HTTP REST + SSE cycle via `streamParts()`
  1. `POST /api/session` with `model: { providerID, id }`
  2. `POST /api/session/{id}/prompt` with prompt text
  3. `GET /api/session/{id}/event?after={cursor}` — SSE polling until `step.ended` or `step.failed`
- **Timeout**: 8 minutes (AbortController timeout on session creation)
- **Session model**: Fresh session per request, no persistent sessions in code
- **Abort handling**: `options.abortSignal` listener calls `POST /api/session/{id}/interrupt` (OpenCode 1.18+)
- **Permission events**: `permission.v2.asked` SSE events are detected and logged but not auto-approved

### Transport Selection

The `selectChatTransport()` function (in `cliAgents.ts`) routes model IDs:

```typescript
// Canonical model IDs (agent/opencode/<provider>/<model>)
executionMode === 'streaming' → { kind: 'streaming-opencode' }
executionMode === 'cli'       → { kind: 'cli-agent' }

// Legacy model IDs (opencode/...)
any executionMode → { kind: 'normal' }  // routed via buildChatModel
```

---

## Selector Persistence

The transport selection is persisted per-conversation in `conversation.settings.openCodeExecutionMode`:

**Storage**: Supabase `conversations` table → `settings` JSON field

**Default**: `'cli'` (for backward compatibility)

**Execution mode precedence** (server-side, aiChat.ts):

1. **Explicit `openCodeExecutionMode` in request body** — user's current UI selection (takes priority)
2. **Persisted `conversation.settings.openCodeExecutionMode`** — DB fallback for previous requests
3. **Default `'cli'`** — backward compatibility

The explicit body value eliminates the persistence race: when a user toggles the transport selector, the new value is sent with every request immediately, even before the database write completes. This ensures the server always uses the most recent client-side selection.

**UI — Segmented control** (`src/components/TextAreaChat.tsx`):

The transport selector is a compact two-button segmented control:

```
┌───────────────┐  ┌───────────────┐
│  CLI          │  │  Streaming    │  ← inactive (muted text)
└───────────────┘  └───────────────┘

┌───────────────┐  ┌───────────────┐
│  CLI          │  │  Streaming    │  ← active (blue highlight)
└───────────────┘  └───────────────┘
```

- Each button is fully clickable
- Active mode is visually highlighted (blue background + text)
- Compact width: `h-8` with `shrink-0` — never compressed by the flex row
- ModelSelector constrained to `max-w-[240px]` to prevent overflow on mobile

**UI persistence**:

- `src/views/EditorView.tsx` stores `openCodeExecutionMode` in conversation settings
- Toggling the mode in the UI updates the setting immediately (async DB write)
- The setting survives page reload and session restore
- Changes to executionMode affect future messages in the conversation

**Server-side persistence**:

- `src/server/aiChat.ts` reads `conversation.settings?.openCodeExecutionMode` at line ~1087
- `ChatSession.tsx` sends `openCodeExecutionMode` in every request body via `prepareSendMessagesRequest`
- Defaults to `'cli'` if not set
- The value flows through to `selectChatTransport()` at line 1276

---

## OpenCode Base URL & Auth

### Configuration

The OpenCode server URL is resolved in this priority order (in `opencodeApiUrl()`):

1. `OPENCODE_BASE_URL` — full URL (takes precedence over everything)
2. `OPENCODE_PORT` — port only (legacy, ignored when `OPENCODE_BASE_URL` is set)
3. Default: `http://127.0.0.1:4096`

**In `start.sh`**:

```bash
OPENCODE_HOST="127.0.0.1"
OPENCODE_PORT="${OPENCODE_PORT:-4096}"
OPENCODE_URL="http://${OPENCODE_HOST}:${OPENCODE_PORT}"
```

The server is started with `opencode serve --port "${OPENCODE_PORT}" --hostname "${OPENCODE_HOST}"`.

### Health Check

The health endpoint is at `${OPENCODE_BASE_URL:-${OPENCODE_URL}}/api/health`.

`start.sh` checks health before proceeding:

```bash
curl -sf -m 2 "${OPENCODE_HEALTH}" > /dev/null 2>&1
```

If the server is not healthy, it starts the server and waits up to 20 seconds.

### Authentication

pCAD does not pass credentials to the OpenCode API. The server runs on the same host (loopback), so no auth headers are needed. The OpenCode server relies on local access controls.

---

## Server Start Command

### Full startup sequence (`start.sh`)

```bash
# 1. Start Podman socket
systemctl --user enable podman.socket --now
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"

# 2. Start Supabase
npx supabase start

# 3. Start OpenCode server (if not already healthy)
nohup opencode serve --port 4096 --hostname 127.0.0.1 \
  > /tmp/opencode-serve.log 2>&1 &

# 4. Start Vite dev server
npm run dev
```

### Prerequisites

- Node.js 20.19+ or 22.12+
- Podman for Supabase container
- `inotify.max_user_instances` set to 512 (default 128 exhausted by containers)
- File descriptor limit: 65536 (`ulimit -n 65536`)

### Environment Variables

| Variable                    | Purpose                       | Default                     |
| --------------------------- | ----------------------------- | --------------------------- |
| `OPENCODE_BASE_URL`         | Full OpenCode server URL      | `http://127.0.0.1:4096`     |
| `OPENCODE_PORT`             | OpenCode server port (legacy) | `4096`                      |
| `WEBHOOK_BASE_URL`          | Webhook callback URL          | Derived from request origin |
| `VITE_SUPABASE_URL`         | Supabase project URL          | `http://127.0.0.1:54321`    |
| `VITE_SUPABASE_ANON_KEY`    | Supabase anon key             | From `.env.local`           |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key     | From `.env.local`           |

---

## Agent & Tool Semantics

### Parametric Model Generation

When the agent produces OpenSCAD code, pCAD triggers the `build_parametric_model` tool call. This happens via the shared parser module:

**Location**: `src/server/opencodeAgentResult.ts`

**Exports**:

- `parseAgentResult(text)` — parses final agent result (JSON `{code,message}` or fenced OpenSCAD code)
- `parametricBuildInput(accumulatedText)` — extracts build input from accumulated text
- `finishWithParametricToolCall(accumulatedText, finishPart)` — emits exactly one `build_parametric_model` tool-call at terminal finish

**Both transports share this module**:

- CLI transport: `cliAgents.ts` imports `parseAgentResult` and `finishWithParametricToolCall`
- Streaming transport: `opencode.ts` imports `finishWithParametricToolCall`

### Progressive vs Final Results

- **Progressive**: Text deltas stream per-event (already streamed per-delta)
- **Final**: Only the complete terminal result is parsed — exactly once, via the shared final-result handler

### Tool Call Detection

Fenced OpenSCAD blocks trigger the `build_parametric_model` tool call:

- No fuzzy keywords — exact match on fenced code blocks
- Both CLI and streaming transports use identical detection logic

---

## Permissions Behavior

### CLI Path

**Actual runtime behavior**: `opencode run --pure --format json` (no `--auto`, no `--env deny`)

- `--pure` disables external plugins
- `--auto` is NOT passed → prevents auto-approval of tool permissions
- `--env deny` does NOT exist in OpenCode 1.18.18 (documentation error corrected 2026-08-15)
- `OPENCODE_PERMISSION` variables are NOT set (documentation error corrected 2026-08-15)
- **Behavioral guard**: Prompt instruction tells the model not to use tools

**Limitation**: If the model requests a tool (e.g., `bash`, `edit`), the CLI child process will HANG waiting for permission approval. Since it is non-interactive (piped stdio), there is no way to respond to the permission request. The 8-minute timeout will eventually kill the process.

**Secondary control**: Prompt instruction in the agent prompt: "Do NOT call any tools, do NOT read or write any files, and do NOT mention the app's tools"

### Streaming Path

**Limitation**: OpenCode has no per-session permission API (`POST /api/session` has no `permission` field). Cannot enforce per-session restrictions without a dedicated restricted server instance.

**Current enforcement**:

1. Prompt instruction: "Do NOT call any tools, do NOT read or write any files, and do NOT mention the app's tools"
2. Server-level permissions: Current config allows `edit`, `bash`, `webfetch`, `websearch`, `skill`, `external_directory`
3. `permission.v2.asked` SSE events are detected and logged (G02E) but not auto-approved

**Future improvement**: Consider starting a dedicated restricted OpenCode server for pCAD in a separate process.

### Security Model Summary

```
Prompt instruction (NOT enforced)    → secondary control (both CLI + Streaming)
CLI: --auto NOT passed               → prevents auto-approval (but hangs on tool requests)
Streaming: no per-session API        → documented limitation
permission.v2.asked (detected)       → logged, not auto-approved (Streaming only)
```

---

## History Ownership

### Current Strategy: pCAD owns history

pCAD owns the conversation history with fresh OpenCode sessions per request:

- **No persistent sessions**: Each agent request creates a new OpenCode session via `POST /api/session`
- **History management**: pCAD stores full conversation history in Supabase and manages message context
- **Token budget**: Conversation context is trimmed to stay within model token limits
- **Fresh state**: Each agent invocation starts with a clean slate — no lingering state from previous requests

### Why not OpenCode-owned history?

OpenCode's built-in session persistence would require:

1. Persistent sessions across requests (not currently implemented)
2. History sync from OpenCode back to pCAD (no API for this)
3. OpenCode session IDs stored in pCAD conversations (adds coupling)

The current approach keeps pCAD in full control of conversation lifecycle.

---

## Concurrency

### No Whole-Run Global Lock

Each agent request runs independently with no shared mutexes or locks:

**Streaming path**:

- Each `streamParts()` call creates a fresh `AbortController`
- Each request creates a new OpenCode session
- SSE polling is session-scoped only

**CLI path**:

- Each `runOpenCode()` spawns a separate child process
- No shared state between processes

### Session Isolation

Two independent `processBatch()` states produce no cross-talk:

- Text events in one session never appear in another
- Terminal state in one session does not affect another
- Error recovery in one session is isolated from others

### Error Recovery

- `step.failed` events yield an error part with `isErrored = true`
- Malformed events are safely ignored (no crash)
- Timeout (8 minutes) triggers AbortController cleanup
- Abort handler calls `/api/session/{id}/abort` to clean up the OpenCode session

---

## Troubleshooting

### Streaming Hangs

**Symptom**: Agent request hangs indefinitely with no response

**Causes**:

1. **Rate limiting on free models**: `big-pickle` and `hy3-free` are rate-limited (429 `FreeUsageLimitError`)
2. **Server not running**: OpenCode server failed to start or crashed
3. **Port mismatch**: `OPENCODE_PORT` doesn't match the actual server port
4. **`cursor` query param**: Was previously used instead of `after` — OpenCode API expects `after` parameter

**Fixes**:

1. Switch to a non-rate-limited model or wait for rate limit reset
2. Check `opencode serve` logs at `/tmp/opencode-serve.log`
3. Verify port with `curl -sf http://127.0.0.1:4096/api/health`
4. Confirmed fixed: `eventsUrl.searchParams.set('after', ...)` not `cursor`

### CLI Hangs

**Symptom**: Agent request hangs with no output

**Causes**:

1. **Stdin not piped**: `opencode run` requires stdin to be piped (not `stdio: 'ignore'`)
2. **Output on stderr**: JSON output goes to stderr, not stdout
3. **No TTY**: `opencode run` requires a real TTY for output

**Fixes**:

1. Verify stdin is piped in `runCli()` (confirmed working)
2. Read from stderr in the output handler (confirmed working)
3. The CLI adapter runs in an empty temp directory with proper stdio setup

### Model Not Found

**Symptom**: "model not found" or "provider not registered"

**Causes**:

1. OpenCode server not running or unreachable
2. Model ID format mismatch
3. Model not registered in OpenCode config

**Fixes**:

1. Check server health: `curl http://127.0.0.1:4096/api/health`
2. List available models: `opencode models`
3. Verify model ID format: `agent/opencode/<provider>/<model>` for canonical form

### Permission Denials

**Symptom**: Agent hangs or fails to produce output

**Causes**:

1. CLI: If the model requests a tool (bash, edit, etc.), the non-interactive child process hangs waiting for permission approval (no `--auto` flag, no `OPENCODE_PERMISSION` env vars)
2. Streaming: Server-level permissions allow tools; model may request them despite prompt instructions

**Fixes**:

1. For CLI: The prompt instruction should prevent tool requests. If the model still requests tools, it will hang — the 8-minute timeout will eventually terminate it
2. For Streaming: The model follows the prompt instruction not to use tools
3. If intentional tool access is needed: Run a dedicated OpenCode server with appropriate permissions

### Build / Type Errors

**Symptom**: TypeScript errors or build failures after code changes

**Fixes**:

```bash
npm run typecheck   # Run TypeScript type checking
npm run lint         # Run ESLint
npm run build        # Build the project
npx tsx --test src/server/*.test.ts  # Run server tests
```

### Supabase Connection Issues

**Symptom**: "Supabase connection failed" or auth errors

**Causes**:

1. Supabase not started
2. Port mismatch (should be 54321)
3. Missing or incorrect Supabase keys in `.env.local`

**Fixes**:

```bash
npx supabase start  # Start Supabase
# Verify .env.local contains:
# VITE_SUPABASE_URL=http://127.0.0.1:54321
# VITE_SUPABASE_ANON_KEY=sb_publishable_*
# SUPABASE_SERVICE_ROLE_KEY=sb_secret_*
```

### File Descriptor Exhaustion

**Symptom**: "EMFILE: too many open files" or "inotify watch limit reached"

**Fixes**:

```bash
# Increase inotify instances (needed for Podman containers)
echo "fs.inotify.max_user_instances=512" | sudo tee /etc/sysctl.d/99-inotify.conf
sudo sysctl -p /etc/sysctl.d/99-inotify.conf

# Increase file descriptor limit
ulimit -n 65536  # Add to start.sh
```

---

## Test Suite

### Server Tests

```bash
# Run all server tests
npx tsx --test src/server/opencode*.test.ts

# Currently includes:
# - G01: Stream lifecycle (processBatch state machine) — 15 tests
# - G01: Parser tests (parseAgentResult, fenced code extraction)
# - G02: Permission event handling (detected, logged, not auto-approved)
# - H02/H03: Concurrent session isolation
# - H05: Error recovery (malformed events, step.failed)
```

### Test Results

```

79/79 tests pass, 0 fail
Typecheck: clean
Lint: 0 errors, 15 pre-existing warnings
Build: success
```

---

## Recovery Status

### G01 — Stream Protocol Recovery

- [x] S01: Reproduce text-end-before-delta defect (failing test)
- [x] S02: Extract `processBatch()` state machine from `streamParts()`
- [x] S03: Direct `processBatch()` tests (8 tests)
- [x] S04: Validate repaired stream against real OpenCode response
- **Status**: COMPLETE — lifecycle invariant satisfied (single text-start/end, no delta after end)

### G02 — Permissions

- [x] G02A: Audit CLI/Streaming permission behavior
- [x] G02B: Policy decision (CLI deny-all, Streaming documented limitation)
- [x] G02C: Remove --auto flag from CLI (no `--env deny` exists in OpenCode 1.18)
- [x] G02D: Document Streaming permission limitation
- [x] G02E: Handle permission events deterministically
- [x] G02F: Permission regression tests
- [x] G02G: Full validation gate
- **Status**: COMPLETE

### Phase H — Concurrency & Recovery

- [x] H01: No whole-run global lock (confirmed)
- [x] H02/H03: Concurrent session isolation (tested)
- [x] H05: Error recovery (tested)
- **Status**: COMPLETE

### Phase I — Final Validation

- [ ] I01: Manual CLI regression (blocked by rate limits)
- [ ] I02: Manual Streaming test (blocked by rate limits)
- [ ] I03: Manual two-job test (blocked by rate limits)
- [x] I04: Full project checks (typecheck/lint/build clean)
- [ ] I05: Documentation (this file)
- [ ] I06: Branch reconciliation
- [ ] I07: Final diff review

---

## File Index

| File                                         | Purpose                                                         |
| -------------------------------------------- | --------------------------------------------------------------- |
| `src/server/cliAgents.ts`                    | CLI transport adapter (opencode run / codex run)                |
| `src/server/opencode.ts`                     | Streaming transport adapter (HTTP REST + SSE)                   |
| `src/server/opencodeAgentResult.ts`          | Shared final-result parser + tool-call emitter                  |
| `src/server/opencodeStreamLifecycle.test.ts` | Stream lifecycle + processBatch + permission tests              |
| `src/server/opencodeRouting.test.ts`         | Transport routing tests                                         |
| `src/server/env.ts`                          | Environment variable helpers                                    |
| `src/server/serverLog.ts`                    | Logging utilities                                               |
| `src/views/EditorView.tsx`                   | UI: executionMode toggle, persisted per-conversation            |
| `src/components/chat/ChatSession.tsx`        | Chat session component with executionMode prop                  |
| `src/server/aiChat.ts`                       | Server: reads executionMode, selects transport, handles billing |
| `start.sh`                                   | Startup script (Podman → Supabase → OpenCode → Vite)            |
