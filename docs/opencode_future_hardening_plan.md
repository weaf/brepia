# OpenCode Future Hardening Plan

Status: **DEFERRED / FUTURE IMPLEMENTATION**

Checkpoint branch: `local-dev-continue`

Checkpoint reviewed: `e525f3e0dba2a170f28a97464e9b1b63f6ea7189`

Purpose: preserve the exact remaining work discovered after OpenCode Streaming began producing real pCAD models. This file is a future implementation plan, not an instruction to start work now. Resume only when the user explicitly selects a task.

---

# 0. Preserve the verified baseline

Future changes must not regress the following verified behavior.

## 0.1 Transport and routing

- The same canonical OpenCode model ID can be used in CLI or Streaming mode.
- The UI-selected execution mode is sent explicitly in each chat request.
- Server precedence remains:
  1. explicit request `openCodeExecutionMode`
  2. persisted conversation setting
  3. default `cli`
- `streaming-opencode` is selected only for OpenCode models in Streaming mode.
- There is no silent Streaming -> CLI or CLI -> Streaming fallback.

## 0.2 OpenCode SSE transport

- `/api/session/{id}/event` is treated as long-lived SSE.
- SSE is consumed incrementally from `Response.body`.
- No `Response.text()` wait-for-EOF behavior may be reintroduced.
- Text/reasoning lifecycle remains valid:
  - `text-start -> text-delta* -> text-end`
  - `reasoning-start -> reasoning-delta* -> reasoning-end`
- No delta may be emitted after its corresponding end event.
- User Stop and timeout interrupt the server-side OpenCode session via the verified interrupt endpoint.

## 0.3 Agent semantic bridge

- CLI and Streaming use the same canonical final-result contract.
- Canonical final result remains:

```json
{"code":"complete runnable OpenSCAD source or empty string","message":"short user-facing status"}
```

- CAD request:
  - `code` contains one complete runnable OpenSCAD artifact.
  - `message` is short user-facing status.
- Non-CAD request:
  - `code` is empty.
  - `message` contains the normal answer.
- pCAD, not OpenCode, converts a non-empty `code` into `build_parametric_model`.
- `parseAgentResult()` remains the shared parser for final results.
- Final artifact detection runs only after the complete result, never on partial stream fragments.
- A final accepted artifact produces exactly one synthetic `build_parametric_model` call.

## 0.4 Project-local OpenCode agent

Current Streaming sessions use project-local `pcad-builder` while preserving the user's selected model.

The current agent:

- denies regular filesystem/shell/web/network/etc. OpenCode tools;
- allows `pcad_validate`;
- requests validation before final output;
- limits validation attempts;
- returns the canonical JSON artifact.

Future work must preserve the rule that selecting `pcad-builder` must not silently replace the user-selected inference model.

## 0.5 Independent pCAD validation

pCAD currently validates returned OpenSCAD independently of what the model claims.

Current behavior to preserve:

1. receive completed agent artifact;
2. parse `code`;
3. compile exact returned source with `validateOpenScad()`;
4. if compilation fails, return compiler diagnostics to the same OpenCode session;
5. allow a bounded number of repair attempts;
6. only expose/convert the accepted final candidate;
7. fail safely after the repair limit.

Do not regress to trusting a model-generated `"valid": true` claim.

---

# 1. F01 — Streaming progress feedback

Priority: **HIGH**

Reason: this is the most visible remaining UX defect.

## 1.1 Current problem

The OpenCode HTTP/SSE transport now receives events incrementally, but `streamParts()` intentionally withholds model text/reasoning while the CAD candidate is being generated and validated.

This prevents known-invalid drafts from reaching the user, which is desirable for artifact integrity, but the browser can look idle for a long period. The only visible feedback may be the Stop button.

A user therefore cannot distinguish:

- request has not started;
- connecting to OpenCode;
- OpenCode session created;
- model is thinking;
- model is generating a candidate;
- pCAD is validating the candidate;
- validation failed and repair is running;
- build is being handed to pCAD;
- request is stalled.

## 1.2 Desired UX

Expose coarse, trustworthy workflow states without exposing chain-of-thought or invalid draft code.

Recommended states:

```text
Connecting to OpenCode…
Preparing model…
Generating OpenSCAD…
Validating OpenSCAD…
Repairing OpenSCAD (attempt 2/3)…
Building model…
Done
```

The exact wording can be localized later. The important part is a small finite state model.

## 1.3 Implementation approach

### F01A — Audit existing UI status infrastructure

Inspect:

- chat request status already exposed by AI SDK;
- `TextAreaChat` submitted/streaming state;
- assistant message rendering;
- any existing spinner/status component;
- any custom data-part support already used by pCAD;
- whether server can emit custom UI message metadata or data parts without breaking current AI SDK behavior.

Deliverable:

- choose one existing mechanism for progress events;
- do not build a second parallel status transport if an existing AI SDK UI-part mechanism is available.

### F01B — Define server-side progress state type

Create one narrow type, for example:

```ts
type OpenCodeProgressStage =
  | 'connecting'
  | 'generating'
  | 'validating'
  | 'repairing'
  | 'building';
```

Optional metadata:

```ts
{
  stage: 'repairing',
  attempt: 2,
  maxAttempts: 3
}
```

Do not send:

- hidden reasoning;
- raw model drafts;
- internal prompts;
- filesystem paths;
- OpenCode permission/config details;
- compiler diagnostics unless they are deliberately user-safe.

### F01C — Emit state transitions from actual runtime boundaries

Do not estimate stages from timers. Emit them where the actual operation occurs.

Suggested mapping:

- before/while `POST /api/session` -> `connecting`
- after prompt submission / before model terminal result -> `generating`
- immediately before `validateOpenScad()` -> `validating`
- after failed validation and before repair prompt -> `repairing`
- after accepted artifact and before synthetic build tool call -> `building`

Each stage should be emitted once per transition rather than repeatedly for every SSE chunk.

### F01D — Render one compact progress indicator

Requirements:

- visible on desktop and mobile;
- appears quickly after Send;
- updates in-place instead of appending many chat messages;
- disappears/replaces itself when normal final output/build arrives;
- remains visible during long model generation;
- Stop remains available;
- no horizontal overflow on mobile.

### F01E — Cancellation/error behavior

If user presses Stop:

- remove active progress state;
- do not show "Done";
- show normal cancelled/stopped UI behavior.

If real provider/network error occurs:

- progress indicator must terminate;
- existing error UI remains authoritative.

### F01F — Tests

Cover at minimum:

1. connecting -> generating transition;
2. generating -> validating transition;
3. validation failure -> repairing attempt 1/3;
4. repaired candidate -> validating again;
5. accepted candidate -> building;
6. Stop clears progress;
7. provider error clears progress;
8. progress event does not contain raw reasoning or SCAD draft;
9. non-OpenCode paths are unchanged.

### F01G — Manual acceptance

Desktop + mobile:

- use Big Pickle or another fast model;
- verify first visible progress within a few seconds;
- verify Qwen slow/warm-load case remains understandable;
- force one invalid candidate if a deterministic fixture/test agent can do so and verify Repairing state;
- verify Stop while Generating;
- verify Stop while Validating if practical;
- verify second request works normally.

## 1.4 Acceptance criteria

F01 is done only if a user can tell that work is progressing without exposing invalid code or chain-of-thought.

---

# 2. F02 — Existing-model edit context / multi-turn CAD editing

Priority: **CRITICAL BEFORE CLAIMING FULL CAD EDITOR PARITY**

## 2.1 Current risk

`formatPrompt()` preserves text/reasoning conversation parts but intentionally drops tool calls and tool results.

The canonical pCAD system prompt, however, is designed for an iterative CAD editor. A previous assistant turn may have created the complete model only inside a `build_parametric_model` tool call.

Example:

Turn 1:

```text
User: Create a box with a bottom.
Assistant -> build_parametric_model(code="...")
```

Turn 2:

```text
User: Make the walls 2 mm thicker.
```

If Streaming OpenCode receives only normal prose history, it may not receive the actual current OpenSCAD source and therefore cannot reliably edit the existing model.

## 2.2 Goal

For any edit/fix request, OpenCode must receive the authoritative current artifact needed to modify it.

Do not rely on the model remembering source code from prose.

## 2.3 Design decision to make first

Choose the authoritative source of current CAD state.

Preferred candidates, in order:

1. current persisted pCAD artifact/model source from conversation/branch state;
2. latest successful `build_parametric_model` tool-call input in the active branch;
3. another existing authoritative model record already used by EditorView.

Do not scrape rendered UI text.

## 2.4 Implementation tasks

### F02A — Trace existing model persistence

Document:

- where `build_parametric_model` input is persisted;
- how branch/current leaf selection works;
- how retries affect active artifact;
- how current model source is restored after reload;
- how an edit request identifies the current artifact.

### F02B — Create explicit current-artifact context

When the active conversation contains a current parametric artifact, add a dedicated context section to the OpenCode prompt, for example:

```text
<current_pcad_artifact>
The following is the authoritative current OpenSCAD model to edit.
...
</current_pcad_artifact>
```

Requirements:

- include only the current branch's authoritative source;
- include complete source, not a diff;
- avoid duplicating many historical model versions;
- preserve normal conversation history separately;
- clearly say an edit request should modify this source rather than recreate an unrelated model.

### F02C — Context-size protection

For very large OpenSCAD source:

- define a maximum supported artifact size;
- do not silently truncate source in the middle of syntax;
- if source exceeds safe context limits, fail explicitly or use a deliberate compression/file-reference strategy later.

### F02D — Retry/branch correctness

Test conversation branching:

- build model A;
- edit -> model B;
- branch back to model A;
- make another edit;
- OpenCode must receive model A, not model B.

### F02E — Tests

At minimum:

1. first CAD request with no prior artifact works;
2. second edit request receives previous complete code;
3. edit prompt does not receive obsolete sibling-branch code;
4. reload preserves editability;
5. retry from earlier user turn uses correct artifact;
6. non-CAD chat does not unnecessarily inject a huge artifact if not needed, unless simpler architecture deliberately always includes it;
7. CLI and Streaming semantics remain aligned where applicable.

### F02F — Manual acceptance scenarios

Use one model and edit it across at least four turns:

1. create a box with bottom;
2. make walls thicker;
3. add two mounting holes;
4. change dimensions only;
5. verify previous features remain.

Also test:

- reload between turns;
- mobile edit;
- switch CLI/Streaming between turns if both are expected to support edit parity.

## 2.5 Acceptance criteria

An edit instruction must modify the current authoritative model rather than start from an inferred/reconstructed design.

---

# 3. F03 — Reconcile BOSL2 policy with the restricted agent and validator

Priority: **HIGH FOR ADVANCED CAD**

## 3.1 Current contradiction

CADAM's parametric prompt explicitly recommends BOSL2 and uses includes such as:

```scad
include <BOSL2/std.scad>
include <BOSL2/screws.scad>
```

The project-local `pcad-builder` currently says:

```text
Do not use include, use, filesystem paths, network content, or unknown external dependencies.
```

This means simple primitive-only models work, but the advanced CAD guidance and the restricted agent contract disagree.

## 3.2 Desired policy

Distinguish **approved bundled CAD libraries** from arbitrary filesystem dependencies.

Recommended policy:

- allow known BOSL2 library includes that pCAD's actual OpenSCAD runtime supports;
- continue denying arbitrary file includes/paths;
- validation environment must match actual build environment for approved libraries.

## 3.3 Implementation tasks

### F03A — Audit actual BOSL2 availability

Verify:

- how the production/runtime OpenSCAD finds BOSL2;
- include search path;
- exact supported module paths;
- whether `/usr/bin/openscad` used by `validateOpenScad()` sees the same library path;
- whether local dev, container/deployment, and browser render/export paths agree.

Do not change prompts until this is proven.

### F03B — Define allowlist

Create one source of truth for approved includes, for example:

```text
BOSL2/std.scad
BOSL2/screws.scad
BOSL2/threading.scad
BOSL2/skin.scad
BOSL2/beziers.scad
BOSL2/rounding.scad
```

Do not automatically allow arbitrary `<...>` includes.

### F03C — Align pcad-builder instructions

Replace blanket `include/use` prohibition with precise language:

- approved bundled BOSL2 includes are allowed;
- arbitrary local paths/imports remain prohibited unless supplied by pCAD through an explicit attachment mechanism;
- unknown dependencies are prohibited.

### F03D — Align validator

The validator must compile approved BOSL2 code in the same effective environment as pCAD's final build path.

If needed:

- pass explicit OpenSCAD library path/environment;
- use a controlled library directory;
- verify no broader filesystem access is unintentionally granted.

### F03E — Tests

1. simple primitive SCAD validates;
2. approved BOSL2 include validates;
3. unsupported include fails safely;
4. arbitrary absolute path does not become an accepted dependency;
5. threaded-hole example validates;
6. generated result still produces exactly one build.

### F03F — Manual acceptance

Generate at least:

- M6 screw or threaded hole;
- rounded/organic BOSL2 object;
- another model requiring an approved module.

Compare validator and final browser/STL behavior.

---

# 4. F04 — STL/import attachment editing compatibility

Priority: **HIGH IF STL EDITING IS A REQUIRED PRODUCT FEATURE**

## 4.1 Current contradiction

CADAM's normal instructions require attached STL models to be used with:

```scad
import("filename.stl")
```

The restricted OpenCode agent currently forbids filesystem paths/includes/import-like external dependencies.

Also, `validateOpenScad()` currently compiles an isolated temporary source file. An STL referenced by filename will not automatically exist in that temporary directory.

## 4.2 Goal

Support user-provided STL imports without giving the OpenCode model general filesystem access.

## 4.3 Recommended architecture

Do not let the model browse the project filesystem.

Instead:

1. pCAD already knows the user's attached asset;
2. server materializes only that approved attachment into an isolated validation workspace;
3. generated OpenSCAD receives a stable sanitized filename/reference;
4. validator compiles with only the approved attachment available;
5. final pCAD build uses the same reference semantics.

## 4.4 Implementation tasks

### F04A — Audit existing attachment pipeline

Document:

- upload storage;
- asset IDs;
- local/temporary file materialization;
- how current non-OpenCode CAD path gives attachment information to the model;
- how final OpenSCAD renderer resolves `import()`.

### F04B — Define attachment manifest

Prompt context should contain only explicit approved metadata, e.g.:

```json
{
  "attachmentId": "...",
  "filename": "user_model.stl",
  "dimensions": [x,y,z]
}
```

Avoid exposing storage paths or arbitrary URLs unless required.

### F04C — Isolated validation workspace

For validation:

- create temporary directory;
- write candidate.scad;
- copy/link only approved attachment(s) under sanitized names;
- execute OpenSCAD in that workspace;
- remove workspace afterward.

Protect against:

- `../` traversal;
- absolute paths;
- filenames supplied by the model that were not in the manifest;
- symlink escapes if links are used.

### F04D — Prompt/agent policy

Clarify:

- arbitrary filesystem access remains forbidden;
- only pCAD-provided attachment names are valid `import()` targets;
- do not recreate attached STL from scratch when user's intent is to edit/use it.

### F04E — Tests

1. approved STL import compiles;
2. missing asset produces safe diagnostic;
3. `../secret.stl` rejected;
4. absolute path rejected/not materialized;
5. two attachments cannot be confused;
6. edit request preserves original imported STL and adds/cuts geometry around it;
7. validation and final build use same filename semantics.

### F04F — Manual acceptance

- attach a known STL;
- add a base;
- cut a hole;
- rotate/reposition;
- reload and edit again;
- export final STL.

---

# 5. F05 — Strengthen OpenSCAD validation semantics

Priority: **MEDIUM-HIGH**

## 5.1 Current behavior

`validateOpenScad()` currently treats `openscad` exit code 0 as `valid: true` and reports output byte size.

This proves successful compilation, but not necessarily a useful model.

Potential cases:

- empty geometry;
- zero-byte/tiny STL;
- warnings indicating missing imported file while command still exits unexpectedly successfully in some environments;
- degenerate/non-manifold geometry;
- geometry far outside expected dimensions;
- syntactically valid but obviously unrelated artifact.

## 5.2 Scope decision

Separate validation layers:

### Layer 1 — compile validation

Current OpenSCAD compiler result.

### Layer 2 — artifact sanity

Cheap deterministic checks such as output exists and minimum size.

### Layer 3 — geometric quality

Optional later mesh inspection, not required to complete F05 unless existing tooling already makes it easy.

## 5.3 Implementation tasks

### F05A — Enforce non-empty output

Define minimum requirements:

- exit code 0;
- output file exists;
- output bytes > sensible minimum;
- optionally reject known "empty top level object" diagnostic.

Do not choose an arbitrary large threshold that rejects simple valid geometry.

### F05B — Structured diagnostic classification

Return machine-readable reason where practical:

```ts
type ValidationFailureKind =
  | 'syntax'
  | 'missing_dependency'
  | 'empty_geometry'
  | 'timeout'
  | 'aborted'
  | 'compiler_error'
  | 'unknown';
```

The repair prompt can then be more precise than one raw stderr string.

### F05C — Timeout distinction

Current compile timeout kills the process. Ensure timeout is reported as timeout, not indistinguishable from generic compiler failure.

### F05D — Optional mesh sanity

If feasible with existing dependencies/tools:

- triangle count > 0;
- finite bounding box;
- non-zero dimensions;
- maybe manifold checks.

Do not add a heavyweight mesh stack solely for this unless product value justifies it.

### F05E — Tests

- valid cube;
- syntax error;
- empty top-level geometry;
- timeout fixture if practical;
- aborted validation;
- missing approved dependency;
- valid very-small model should not be false-negative.

---

# 6. F06 — Harden validator isolation/security

Priority: **MEDIUM, HIGHER BEFORE MULTI-USER/EXPOSED DEPLOYMENT**

## 6.1 Current risk model

The OpenCode agent's tool permissions restrict the agent, but generated SCAD is then executed by `/usr/bin/openscad` on the server.

Prompt rules are not a security boundary for the generated program.

The validator therefore needs its own trust model.

## 6.2 Threats to consider

Depending on OpenSCAD capabilities/environment:

- arbitrary `import()` reads;
- `include/use` reads;
- path traversal;
- resource exhaustion from huge geometry/recursion;
- long compile time;
- excessive memory usage;
- excessive output size;
- access to server-visible library paths.

## 6.3 Implementation tasks

### F06A — Threat-model the exact OpenSCAD version

Verify actual capabilities instead of assuming.

Document:

- filesystem reads available from SCAD;
- environment/library search behavior;
- external command capabilities, if any;
- recursion/resource controls;
- current user identity under which OpenSCAD runs.

### F06B — Resource limits

Keep wall-clock timeout and add reasonable limits where platform permits:

- process memory;
- CPU time;
- maximum source bytes;
- maximum output bytes;
- maximum number of validation attempts.

### F06C — Filesystem isolation

If arbitrary SCAD is considered untrusted, evaluate executing OpenSCAD in:

- dedicated container;
- bubblewrap/firejail-like sandbox;
- restricted namespace;
- another project-compatible isolation mechanism.

The isolated environment should expose only:

- candidate source;
- approved BOSL2 libraries;
- explicitly approved attachments;
- output destination.

### F06D — Failure behavior

If sandbox setup fails, fail closed rather than silently compile outside isolation once isolation becomes an enforced security requirement.

### F06E — Tests

Add negative cases for attempted path access and resource exhaustion where deterministic/safe.

---

# 7. F07 — Validation/repair workflow consistency

Priority: **MEDIUM**

## 7.1 Current architecture

There are two related validation ideas:

1. `pcad-builder` is instructed to call `pcad_validate` before returning final code.
2. pCAD independently calls `validateOpenScad()` on the completed result and may run its own bounded repair loop.

The independent pCAD check is important because the model must not be trusted to have called the tool correctly.

However, duplicated validation can increase latency and complexity.

## 7.2 Future design decision

Measure before removing either layer.

Questions:

- Does `pcad_validate` materially improve first-pass success?
- How often does the pCAD-side validation catch something the agent claimed was valid?
- How much latency does double validation add?
- Are agent-side diagnostics better for repair because they are available during generation?

## 7.3 Instrumentation

Record non-sensitive metrics/logging:

- validation attempts inside OpenCode agent, if observable safely;
- final pCAD validation result;
- repair count;
- total validation time;
- compile failure category.

Do not log full user CAD source by default.

## 7.4 Possible future simplification

Only after evidence:

- keep pCAD-side validation as authoritative;
- optionally retain `pcad_validate` as a model-assistance tool;
- or simplify the agent if duplicate validation gives no benefit.

Never remove pCAD's authoritative final validation solely to reduce latency.

---

# 8. F08 — Raw JSON/reasoning and final-message UX

Priority: **MEDIUM**

## 8.1 Goals

The user should see:

- useful progress;
- final concise message;
- generated model/build result.

They should not see:

- raw `{code,message}` JSON unless debugging is intentionally enabled;
- full OpenSCAD source dumped as chat text when the build succeeds;
- hidden reasoning/chain-of-thought;
- rejected repair drafts;
- internal compiler/debug messages unless surfaced in a user-appropriate error.

## 8.2 Tasks

### F08A — Audit current rendered assistant parts

Test:

- Big Pickle;
- Qwen;
- model that emits reasoning;
- corrected multi-JSON response;
- failed validation.

Record exactly what becomes visible.

### F08B — Define visible final result

On successful CAD build:

- build/tool card is primary artifact;
- `message` becomes concise assistant text if needed;
- structured code payload remains internal to build handling.

On non-CAD:

- empty code;
- normal message shown.

On validation failure:

- user-safe error message;
- no invalid model build.

---

# 9. F09 — OpenCode sessions lifecycle / cleanup policy

Priority: **LOW-MEDIUM**

## 9.1 Verified fact

Earlier audit found sessions created by live validation are present in the OpenCode session list for the pCAD project and persist after completion.

This is not currently a functional defect.

## 9.2 Future questions

- Should every pCAD request create a fresh OpenCode session forever?
- Does accumulated session storage become large?
- Is there a retention policy?
- Do we need session deletion after successful completion?
- Would deleting sessions make debugging harder?

## 9.3 Recommended default

Do not change session behavior until storage/operational impact is measured.

If cleanup is added:

- never delete while a stream is active;
- preserve enough diagnostic metadata for failures;
- do not accidentally delete user's unrelated OpenCode sessions;
- only target session IDs created by pCAD itself.

---

# 10. F10 — OpenCode CLI provider/model compatibility

Priority: **SEPARATE / ON DEMAND**

## 10.1 Known case

`ollama-cloud/gpt-oss:20b` previously produced an OpenCode CLI exit-1/no-output issue. A later direct reproduction reportedly exited 0 but returned no final JSON/stdout.

Do not conflate this with Streaming.

## 10.2 Task sequence if CLI support is needed

### F10A — Verify model ID

Run/list actual installed OpenCode models and confirm exact provider/model ID.

### F10B — Reproduce direct command

Use the exact command pCAD generates:

```bash
opencode run --format json --pure -m <provider/model>
```

Capture:

- exit code;
- stdout;
- stderr;
- OpenCode server/session log;
- whether provider returned content that OpenCode failed to serialize.

### F10C — Compare another known-good OpenCode CLI model

This distinguishes pCAD parser failure from provider-specific OpenCode behavior.

### F10D — Improve diagnostic reporting

Current `opencode exited 1:` with empty stderr is insufficient. Preserve safe stdout/stderr tail and useful process metadata where available.

Do not add silent model fallback.

---

# 11. F11 — Full browser acceptance matrix

Priority: **REQUIRED BEFORE FINAL MERGE/RELEASE CLAIM**

The automated suite is not sufficient. Earlier UI defects and SSE defects were discovered only manually.

## 11.1 Desktop matrix

For OpenCode Qwen and one faster model:

- selector visible;
- CLI selectable;
- Streaming selectable;
- active mode visually clear;
- first request uses selected transport;
- generated model appears;
- exactly one intended build;
- STL export works;
- Stop works;
- second request after Stop works;
- reload preserves execution mode;
- multi-turn edit preserves model state.

## 11.2 Mobile matrix

At approximately 360, 390, and 412 px widths:

- model picker visible;
- CLI/Streaming control visible;
- Send/Stop visible;
- no horizontal overflow;
- Streaming progress visible;
- generated model reachable/usable;
- app switching/backgrounding behavior understood;
- reload behavior safe;
- Stop works;
- subsequent request works.

## 11.3 CAD scenarios

At least:

1. simple cube/box;
2. box with hollow interior/bottom;
3. modify existing model;
4. invalid candidate -> repair;
5. BOSL2 model after F03;
6. attached STL edit after F04;
7. non-CAD prose control -> zero build.

## 11.4 Transport parity

For the same OpenCode model and same simple CAD request:

- CLI and Streaming should produce equivalent artifact semantics;
- they do not need identical wording/code;
- both must produce valid build artifacts;
- neither may silently use the other transport.

---

# 12. F12 — Final merge gate

Priority: **LAST**

Do not merge while selected future work is in progress.

When the user decides the feature is ready:

## 12.1 Repository reconciliation

- fetch origin;
- inspect `origin/master...HEAD`;
- reconcile master-only commits deliberately;
- prefer merge over history-rewriting rebase for the shared feature branch unless explicitly decided otherwise;
- resolve planning/status document conflicts intentionally.

## 12.2 Full validation

Run:

```bash
npm run typecheck
npm run lint
npm run build
npx tsx --test src/server/*.test.ts
```

Also run any frontend/component/browser tests added by F01/F02/etc.

Requirements:

- typecheck clean;
- lint 0 errors (warnings explicitly reviewed);
- build succeeds;
- all tests pass;
- `git diff --check` passes;
- no unintended generated files;
- no secrets;
- no unrelated local files accidentally committed.

## 12.3 Manual acceptance

Repeat the relevant subset of F11 after branch reconciliation, not only before it.

## 12.4 Final code review focus

Review specifically:

- cancellation/interrupt lifecycle;
- exact-once build semantics;
- model/transport routing;
- current-artifact context correctness;
- validator sandbox/attachment policy;
- BOSL2 consistency;
- mobile layout;
- progress status cleanup;
- no raw reasoning exposure;
- no silent fallback.

---

# 13. Recommended future execution order

Unless a new product requirement changes priorities, use:

```text
F01  Progress feedback
F02  Existing-model edit context
F03  BOSL2 policy/runtime alignment
F04  STL attachment/import isolation
F05  Validation quality
F06  Validator sandbox/resource hardening
F07  Validation workflow simplification/telemetry
F08  Final-message/raw-output UX cleanup
F09  Session retention/cleanup if needed
F10  Provider-specific CLI compatibility if needed
F11  Full browser acceptance
F12  Final merge gate
```

Rationale:

- F01 fixes the immediate user experience.
- F02 protects the core promise that pCAD is an editor, not only a one-shot generator.
- F03/F04 restore advanced CAD capabilities without weakening isolation.
- F05/F06 strengthen correctness/security around executing generated SCAD.
- Remaining tasks polish/operate the system after core semantics are reliable.

---

# 14. Rules for future coding-agent runs

When this plan is resumed:

1. Work on exactly one task/subtask at a time.
2. Start with:

```bash
git branch --show-current
git status --short
git log -1 --oneline
git fetch origin
```

3. Preserve unrelated uncommitted/untracked user work.
4. Never use destructive reset/clean/stash automatically.
5. Do not merge to master unless the user explicitly asks for the final merge step.
6. For OpenCode API behavior, verify against the installed OpenCode version and live `/doc` where applicable.
7. For AI SDK lifecycle, verify against installed package types/version.
8. Add tests at the actual production boundary; do not create test-only replicas of production logic.
9. Manual browser acceptance is required for UI/Streaming behavior.
10. Update this plan/status with evidence, not assumptions.

---

# 15. Current checkpoint summary

At this checkpoint, the feature is best described as:

```text
OpenCode model selection/routing        WORKING
OpenCode Streaming HTTP/SSE             WORKING
SSE first-event delivery                WORKING
Shared CAD JSON contract                WORKING
Qwen Streaming -> real pCAD model       WORKING
Independent OpenSCAD compile check      WORKING
Bounded compile-repair loop             WORKING
Exact-one synthetic build               WORKING

Visible progress feedback               TODO
Multi-turn existing-model edits         NEEDS HARDENING/TESTING
BOSL2 compatibility                     POLICY CONFLICT
STL/import editing                       POLICY/VALIDATOR CONFLICT
Validation quality beyond compile       HARDENING NEEDED
Validator isolation                     HARDENING NEEDED
Full desktop/mobile acceptance          INCOMPLETE
Final merge gate                        NOT YET
```

This document is the handoff for future implementation. Do not automatically continue the backlog without an explicit user-selected next task.
