# BRep Phase 3F live checkpoint

## Scope

This checkpoint records final 3F-D live acceptance evidence for external OpenCode **Streaming** and **CLI** BRep editing on `feature/brep-ai-native-editing`.

Phase 3F is complete and accepted. The next planned Phase 3 step is 3G; unrelated defects should be handled separately rather than mixed into the BRep AI transport scope.

## Implementation checkpoints

The live fixes are contained in:

```text
6d06b7aa3014220a73bed5401cfad9593267d046
Fix live external BRep streaming regressions
```

The strict external BRep tool-input boundary is regression-covered by:

```text
29310a06a62625875464bf3d58ca153c742228fe
Harden external BRep tool input contract
```

## Live environment

The tests used an existing native BRep conversation with the canonical cabinet source and stable published dimensions:

```text
project_id      = phaseOneCabinet
width_default   = 1400
height_default  = 1800
```

External model:

```text
agent/opencode/llama-swap/qwen3.6-35b-mtp-128k
```

## Live-discovered regression 1 — repeated external BRep turns

Initial Streaming execution repeatedly re-entered the same persistent OpenCode session after a successful `build_brep_project` result.

Root cause: Streaming BRep used a stop condition that waited for `answer_user` or the step limit, while the external adapter's terminal structured result is `build_brep_project`.

Fix: external BRep transports now stop the AI SDK turn on `build_brep_project`. The direct/native-provider BRep path retains its existing `answer_user`/step-limit behavior.

Live verification after the fix showed exactly one OpenCode session invocation for the request.

## Live-discovered regression 2 — strict BRep tool input

After the loop fix, the external result reached `build_brep_project` but persisted as `output-error` with no canonical source revision.

Root cause: the external adapter included an OpenSCAD-era `message` property inside the `build_brep_project` tool input. `brepAiBuildInputSchema` is strict and accepts only the native BRep tool contract fields (`title`, `version`, `project`).

Fix: the external agent result may still contain a user-facing `message`, but BRep tool-call input no longer includes that property. OpenSCAD keeps its existing message-bearing build input unchanged.

A regression test parses emitted external BRep tool input through the real strict `brepAiBuildInputSchema`.

## Accepted Streaming evidence

The Streaming rerun changed `cableHole.radius` from 60 mm to 75 mm and produced one active immutable assistant/source revision:

```text
active            = true
source_parts      = 1
brep_build_parts  = 1
tool_state        = output-available
output_status     = success
candidate_radius  = 75
```

This proves the Streaming path reached the shared native BRep tool, passed validation, attached one canonical `data-brep-project` source snapshot and activated the revision through the existing atomic persistence path.

## Accepted CLI evidence

A follow-up in OpenCode execution mode **CLI** changed `cableHole.radius` from 75 mm to 85 mm using the same BRep conversation.

Runtime transport evidence:

```text
transportKind = cli-agent
agent         = opencode
model         = llama-swap/qwen3.6-35b-mtp-128k
```

The persistent OpenCode server session was reused. The CLI-agent session was created for this first CLI-mode turn, which is expected when switching from Streaming to CLI because the two adapters maintain their own resumable session identities.

The resulting active persisted revision was:

```text
created_at        = 2026-09-04 06:01:26.122674+00
id                = ffe6fcdf-2174-4058-9efe-b05cb77f287a
parent_message_id = 62c65f3a-2630-47a7-a3ba-807813ec0bbd
active            = true
source_parts      = 1
brep_build_parts  = 1
tool_state        = output-available
output_status     = success
candidate_radius  = 85
```

The active radius-85 revision was then refreshed/reopened in the native BRep view and confirmed to evaluate/render correctly without a new browser/server error.

This proves the CLI path also:

- received and returned a complete native BRep snapshot;
- emitted one successful `build_brep_project` part;
- attached exactly one canonical `data-brep-project` source part;
- activated the new immutable revision;
- preserved the existing conversation/source lifecycle rather than falling back to OpenSCAD semantics;
- remained usable through the accepted native evaluator/viewer after refresh.

Historical failed rows remain intentionally retained as regression evidence.

## Codex parity decision

A separate live Codex CLI run is not required for 3F acceptance. Codex and OpenCode CLI share the same source-aware `buildPersistentCliAgentPrompt`/BRep result path; focused tests cover Codex routing, resumable session-ID parsing and native resume syntax while the shared BRep continuation test proves the CLI prompt receives the exact current `BrepProject` and no OpenSCAD artifact wrapper.

A future Codex live run may still be useful as an operator smoke test, but it is not necessary to duplicate the same BRep semantic acceptance merely to close 3F.

## Final decision

**Phase 3F — OpenCode/Codex external-agent parity: complete and accepted.**

The next BRep Phase 3 step is 3G — Product integration / creation UX.
