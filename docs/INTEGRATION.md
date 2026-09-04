# OpenCode integration

This document describes the current OpenCode integration in Brepia 1.0. Historical recovery plans and phase checklists are intentionally not part of this architecture reference.

## Overview

Brepia can use OpenCode-backed models for Parametric generation through two execution modes:

- **CLI** — invokes the local `opencode` CLI through `src/server/cliAgents.ts`.
- **Streaming** — talks to an OpenCode server over HTTP/SSE through `src/server/opencode.ts`.

The selected mode is stored as `openCodeExecutionMode` (`cli` or `streaming`) in conversation settings and is also sent with chat requests. An explicit request value takes precedence over the persisted conversation value; if neither exists, the default is `cli`.

Non-OpenCode providers are not converted into OpenCode transports by this selector.

## Model IDs and transport selection

Current agent-style OpenCode model IDs use:

```text
agent/opencode/<provider>/<model>
```

For these IDs:

- `openCodeExecutionMode=cli` selects the CLI-agent adapter;
- `openCodeExecutionMode=streaming` selects the streaming OpenCode adapter.

Legacy `opencode/...` IDs are still recognized by the transport selector for compatibility. Do not create new naming schemes without updating the catalog, transport selection and persistence behavior together.

The transport selection implementation is in `src/server/cliAgents.ts`; request resolution occurs in the Parametric chat server flow.

## Parametric chat entrypoint

`src/routes/api/parametric-chat.ts` is the TanStack server route for Parametric chat requests. It delegates chat processing to `src/server/aiChat.ts` and wraps normal requests with the conversation-workspace lifecycle.

The OpenCode adapters implement the AI SDK language-model contract expected by the chat pipeline. Their final Parametric result is converted into Brepia's normal tool-call path rather than bypassing persistence/validation: OpenSCAD uses `build_parametric_model`; native BRep uses `build_brep_project`.

`build_parametric_model` is project-native: its artifact carries a complete normalized `OpenScadProject` snapshot with `schemaVersion`, `entrypointPath`, every required `.scad` source file and any Brepia-authoritative explicit asset descriptors. New external-agent results do not use the legacy top-level `code` artifact shape.

## CLI mode

The OpenCode CLI adapter lives in `src/server/cliAgents.ts`.

For OpenCode it invokes the local CLI with the configured model and the repository-local `pcad-builder` agent. The technical `pcad-builder` identifier is retained for compatibility.

CLI sessions are persistent across conversation turns:

- the adapter discovers the external OpenCode session ID from CLI output;
- the session ID is encoded into Brepia's persisted tool-call ID;
- later turns recover that ID from conversation history and resume the same OpenCode session;
- if the external session no longer exists, the adapter can recover by creating a new session instead of treating stale session metadata as permanent state.

Because the session marker is stored with persisted conversation/tool-call data, this mechanism does not depend on a separate server-local session database.

The CLI adapter also supports Codex agent IDs, but Codex and OpenCode keep their own external-session semantics inside the shared CLI adapter.

## Streaming mode

The streaming adapter lives in `src/server/opencode.ts`.

Streaming uses a deterministic OpenCode session for each Brepia conversation. The session ID is derived from the immutable conversation ID using the retained technical prefix:

```text
ses_pcad_<conversation-id-without-separators>
```

On a request, Brepia:

1. resolves the configured OpenCode server URL;
2. checks whether the deterministic session already exists;
3. creates it when absent, or reuses it when present;
4. ensures the session uses the `pcad-builder` agent and requested model;
5. posts the current turn with resume semantics;
6. reads session events over the OpenCode event endpoint using the event cursor;
7. validates and converts the terminal complete-project agent result into Brepia's Parametric tool-call contract;
8. interrupts the OpenCode session when the Brepia request is aborted.

Switching the selected OpenCode model does not require a second Brepia conversation or a second deterministic session; the existing session can switch model in place.

Brepia still persists authoritative conversation/message/model state in its own application data. The persistent OpenCode session is an execution context, not a replacement for Brepia's conversation persistence or conversation workspace.

## Current artifact context

Both OpenCode execution paths preserve continuity without blindly resending an unbounded transcript.

For OpenSCAD continuation turns, the adapters provide the latest complete Parametric project artifact, the latest user request and relevant build feedback. The project snapshot is authoritative for the current model: agents must preserve unchanged support files, may edit the entrypoint and/or support files as required, and should keep `entrypointPath` stable unless restructuring is genuinely necessary.

Explicit asset descriptors are Brepia-managed authority. External agents may preserve or remove them according to the returned source references, but must not invent or mutate `storagePath`, `mediaType`, `byteLength` or `sha256` metadata.

This keeps the agent grounded in the current OpenSCAD revision while Brepia retains authoritative conversation history, private asset storage and model revisions.

For native BRep continuation turns, the chat server resolves the exact active canonical `BrepProject` and supplies it on every external-agent turn in `<current_brep_project>`. BRep agents return a complete BRep snapshot through the separate `build_brep_project` contract. This path does not use OpenSCAD artifact extraction, asset reconciliation, compiler validation, or repair prompts; BRep snapshot/identity validation and immutable persistence remain server-side.

Do not replace this with a "fresh session per request" assumption or a single-entrypoint-source contract. Persistent-session and project-result behavior are covered by regression tests.

## OpenCode server lifecycle

`./start.sh` is the canonical local launcher.

If `OPENCODE_BASE_URL` is set, Brepia treats that server as externally managed and does not start its own OpenCode process.

If `OPENCODE_BASE_URL` is not set, `start.sh` starts a Brepia-owned loopback OpenCode server:

- `OPENCODE_PORT` may request a fixed port;
- otherwise Brepia selects an available loopback port;
- the resulting URL is exported as `OPENCODE_BASE_URL` for the application process;
- startup waits for `/api/health` and fails explicitly if the managed process does not become healthy;
- the managed child is stopped when `start.sh` exits.

Managed-server logs use a port-specific path under `/tmp`, currently:

```text
/tmp/pcad-opencode-<port>.log
```

The `pcad` prefix in that runtime filename is retained as a technical compatibility identifier.

## Authentication

OpenCode server HTTP Basic Auth is optional.

Supported environment variables are:

- `OPENCODE_BASE_URL`
- `OPENCODE_PORT`
- `OPENCODE_SERVER_USERNAME`
- `OPENCODE_SERVER_PASSWORD`

When a password is configured, server requests made by the streaming integration include the corresponding Basic Auth header. Do not log or expose the password/header.

## Model discovery

The streaming integration discovers OpenCode models from the server model API and can merge that result with local CLI model discovery. Discovery is cached for a bounded period in the server process.

Provider/model availability is therefore runtime-derived. Do not copy an old OpenCode model list from documentation into application code.

## `pcad-builder` agent and validation

`.opencode/agents/pcad-builder.md` is the dedicated Parametric OpenCode agent used by Brepia. Its retained `pcad-*` name is a technical identifier.

The agent is intentionally narrow and exposes `pcad_validate` for OpenSCAD validation. Runtime behavior/output-contract instructions are supplied by Brepia for each request. The validation/result contract is project-native: the complete normalized OpenSCAD project is validated and returned, rather than a standalone source string.

Project-local OpenCode skills under `.opencode/skills/` support validation/settings/provider maintenance. Their instructions must be reconciled with `AGENTS.md` and current code; historical implementation plans are not runtime authority.

## Local startup

Normal startup is:

```bash
./start.sh
```

The launcher prepares the rootless Podman environment, starts/checks llama-swap, starts/checks local Supabase, configures OpenCode, and then starts Brepia.

By default it uses the stable production-like runtime. Explicit development HMR is enabled with:

```bash
PCAD_ENABLE_HMR=1 ./start.sh
```

Do not document the old assumption that `./start.sh` always ends in a Vite development server.

## Troubleshooting

Check the server selected by the current environment rather than assuming port 4096. If `OPENCODE_BASE_URL` is explicitly configured, that URL owns the lifecycle. If Brepia manages the server, `start.sh` prints the selected loopback URL and log path.

Useful checks include:

```bash
opencode models
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

When Basic Auth is configured, manual health/API requests must use the configured credentials as well.

For session-continuity and project-result regressions, the current test suite includes coverage for persistent OpenCode sessions, transport-selection precedence and complete multi-file external-agent results, including:

- `tests/opencodePersistentSession.test.ts`
- `tests/opencodeAgentResult.test.ts`
- `src/server/transportSelection.test.ts`

## Maintenance rules

When changing this integration:

- preserve conversation-scoped session continuity unless the task explicitly redesigns it;
- preserve request cancellation/interrupt behavior;
- keep the project-native `build_parametric_model` result contract consistent across CLI and streaming paths;
- preserve unchanged support files across follow-up edits and keep Brepia-managed asset metadata authoritative;
- keep auth secrets server-only;
- preserve compatibility-sensitive `pcad-*` identifiers unless an explicit migration is planned;
- update this document when transport/session or Parametric project-contract behavior changes;
- run the full relevant repository gate before merge.
