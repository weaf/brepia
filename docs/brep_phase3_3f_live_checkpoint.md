# BRep Phase 3F live checkpoint

## Scope

This checkpoint records live 3F-D acceptance evidence for external OpenCode **Streaming** BRep editing on `feature/brep-ai-native-editing`.

Phase 3F remains in progress until the remaining external transport acceptance is completed. Do not treat this checkpoint as permission to start 3G.

## Implementation checkpoint

The live fixes are contained in:

```text
6d06b7aa3014220a73bed5401cfad9593267d046
Fix live external BRep streaming regressions
```

A focused regression test for the strict external BRep tool-input boundary was added immediately afterward.

## Live environment

The accepted Streaming test used an existing native BRep conversation with the canonical cabinet source at:

```text
project_id        = phaseOneCabinet
width_default     = 1400
height_default    = 1800
cable_hole_radius = 60
```

External model/transport:

```text
agent/opencode/llama-swap/qwen3.6-35b-mtp-128k
OpenCode execution mode: Streaming
```

The requested follow-up changed only `cableHole.radius` from 60 mm to 75 mm while requesting stable project/node/parameter identities and preservation of the published Width/Height defaults.

## Live-discovered regression 1 — repeated external BRep turns

Initial live execution repeatedly re-entered the same persistent OpenCode session after a successful `build_brep_project` result.

Root cause: Streaming BRep used a stop condition that waited for `answer_user` or the step limit, while the external adapter's terminal structured result is `build_brep_project`.

Fix: external BRep transports now stop the AI SDK turn on `build_brep_project`. The direct/native-provider BRep path retains its existing `answer_user`/step-limit behavior.

Live verification after the fix showed exactly one OpenCode session invocation for the request.

## Live-discovered regression 2 — strict BRep tool input

After the loop fix, the external result reached `build_brep_project` but persisted as `output-error` with no canonical source revision.

Root cause: the external adapter included an OpenSCAD-era `message` property inside the `build_brep_project` tool input. `brepAiBuildInputSchema` is strict and accepts only the native BRep tool contract fields (`title`, `version`, `project`).

Fix: the external agent result may still contain a user-facing `message`, but BRep tool-call input no longer includes that property. OpenSCAD keeps its existing message-bearing build input unchanged.

A regression test now parses the emitted external BRep tool input through the real strict `brepAiBuildInputSchema`.

## Accepted Streaming evidence

The rerun completed with one OpenCode session invocation and produced the following persisted active assistant revision:

```text
active            = true
source_parts      = 1
brep_build_parts  = 1
tool_state        = output-available
output_status     = success
candidate_radius  = 75
```

This demonstrates the Streaming path reached the shared native BRep tool, passed validation, attached one canonical `data-brep-project` source snapshot, and activated the immutable revision through the existing persistence path.

Historical failed rows were intentionally retained as regression evidence.

## Remaining 3F-D acceptance

Next verify the **OpenCode CLI** path on the same conversation using a single identity-preserving numeric follow-up. The expected acceptance evidence is:

- one external CLI invocation/continuation;
- one successful `build_brep_project` part;
- exactly one `data-brep-project` source part;
- the new immutable revision becomes active;
- project ID and unchanged node/parameter IDs remain stable;
- Width remains 1400 mm and Height remains 1800 mm;
- native BRep evaluation/rendering succeeds after refresh.

After OpenCode CLI acceptance, reconcile whether a separate live Codex CLI call is necessary or whether the shared CLI adapter plus existing Codex session/routing regression coverage provides sufficient parity evidence.
