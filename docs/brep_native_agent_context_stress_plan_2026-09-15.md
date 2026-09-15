# Native BRep agent, context and stress-test plan — 2026-09-15

## Purpose

This document turns the current Native BRep/OpenCode investigation into a bounded sequence of phases that can be resumed from a fresh chat without relying on conversational history.

The immediate problem is not a new canonical geometry opcode. The current work is to make the existing Native BRep language usable through a reliable agentic execution path, with bounded repair, durable progress, controlled context growth and reproducible complex-model evidence.

The primary stress fixture is a parametric wall-mounted electrical control cabinet with a door, mounting plate, DIN rails, ventilation and cable-entry features.

## Permanent boundaries

The following remain invariant throughout this plan:

- `schemaVersion: 1` remains unchanged unless a later separately approved modeling slice explicitly requires otherwise.
- canonical `BrepProject` remains editable source authority.
- build123d/OCCT remains the native geometry authority.
- Rhino/GHX remains an interoperability/compiler/runtime boundary, not canonical source authority.
- exactly-one-solid Boolean semantics remain strict.
- graph/integrity validation remains fail-closed.
- immutable revision semantics remain unchanged.
- agent repair must never weaken canonical validation merely to make a model pass.
- no hidden cabinet-specific special cases may be introduced.
- OpenCode/Codex agent selection must preserve the user-selected inference model.
- PR #36 remains open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged unless explicitly approved otherwise.

## Accepted baseline before this plan

The following findings/fixes are already part of the branch history and must be reconciled rather than reimplemented:

1. A first Native BRep creation could previously become stuck at `revision_saved` without `/api/brep/evaluate` ever being requested.
2. Missing canonical artifact creation now fails terminally instead of leaving an infinite preview spinner.
3. BRep generation progress is presented inline in the conversation UI instead of replacing the whole product view, with expandable persisted generation details.
4. Rejected BRep build attempts are intended to continue to another agent/model step rather than terminating merely because `build_brep_project` was called.
5. External OpenCode/Codex BRep result parsing previously swallowed canonical normalization failures and degraded an invalid structured candidate to `project: undefined`.
6. The CLI OpenCode path now carries a bounded Native BRep result-repair mechanism that can resume the same external session with canonical normalization diagnostics.

Latest checkpoint at the time this plan was written:

```text
ca68319ff5c216585fa41112c9562ec413833628
```

Exact CI on that checkpoint:

- Quality Gate #1135 — PASS
- Grasshopper Build #707 — PASS

## Phase A — Reconciliation and execution-boundary freeze

### A1 — Reconcile current branch

Read and reconcile at minimum:

- `AGENTS.md`
- this document
- `.opencode/agents/pcad-builder.md`
- `src/server/opencode.ts`
- `src/server/cliAgents.ts`
- `src/server/opencodeAgentResult.ts`
- `src/server/aiChat.ts`
- `src/server/brepAiTurn.ts`
- `src/server/brepAiTools.ts`
- `config/ai/instructions/transport-opencode-brep.md`
- `config/ai/instructions/transport-codex-brep.md`
- current OpenCode/Codex session/parity tests
- current generation-run/progress UI implementation

Verify branch HEAD, working-tree assumptions and PR #36 state before changing code.

### A2 — Freeze scope

This plan is agent/runtime/context hardening only.

Do not add:

- shell/thickness;
- chamfer;
- sweep/path solids;
- new revolve semantics;
- a general assembly/body-set node;
- other new canonical geometry operations.

Those remain candidates only after the complex stress test demonstrates a representational gap.

**Exit criterion:** documentation and implementation agree on the current runtime boundary and no speculative geometry work is active.

---

## Phase B — Dedicated Native BRep OpenCode agent

### B1 — Add a dedicated runtime agent

Introduce a dedicated repository-local OpenCode agent, expected shape:

```text
.opencode/agents/brep-builder.md
```

The exact technical identifier may differ if reconciliation shows a better existing naming convention.

The BRep agent must be intentionally narrow:

- no filesystem read/edit unless separately justified;
- no bash;
- no web access;
- no generic task/sub-agent spawning unless separately justified;
- no `pcad_validate` because that tool is OpenSCAD-specific;
- no OpenSCAD-specific behavior;
- runtime behavior and canonical result contract remain Brepia-supplied.

### B2 — Select agent by canonical source kind

Required routing:

```text
OpenSCAD   -> pcad-builder
Native BRep -> brep-builder
```

This selection must work for both persistent Streaming OpenCode sessions and OpenCode CLI sessions.

Changing the agent must not silently change the selected model.

### B3 — Session identity and migration behavior

Define deterministic behavior when an existing persistent conversation session was created with the older `pcad-builder` agent and is later used for Native BRep.

Preferred behavior:

- retain the conversation-specific session identity when safe;
- explicitly switch the OpenCode agent to `brep-builder`;
- preserve the selected provider/model;
- do not replay stale OpenSCAD-specific state as Native BRep authority.

If a fresh session is safer for a source-kind transition, that must be explicit, tested and documented.

### B4 — Tests

Add regression coverage proving:

- OpenSCAD selects `pcad-builder`;
- Native BRep selects `brep-builder`;
- BRep agent does not expose `pcad_validate`;
- selected model is unchanged by agent selection;
- persistent session agent switching is deterministic.

**Exit criterion:** OpenCode has a dedicated Native BRep runtime agent with least privilege and model-preserving routing.

---

## Phase C — Dedicated Native BRep Codex execution profile

Codex CLI does not necessarily expose the same repository-local agent primitive as OpenCode, so do not mechanically copy the OpenCode implementation.

### C1 — Reconcile Codex execution surface

Determine the narrowest supported mechanism for giving Native BRep its own execution profile while preserving:

- read-only/no-write execution boundary;
- selected Codex model;
- canonical BRep output contract;
- persistent/reusable thread semantics where currently supported.

### C2 — Separate BRep transport profile

Use the existing `transport-codex-brep` boundary as the semantic source, but ensure the actual Codex invocation receives BRep-only instructions and does not inherit unnecessary OpenSCAD behavior.

### C3 — Parity tests

Prove that OpenCode and Codex expose equivalent Native BRep semantics even if their underlying runtime-agent mechanisms differ.

**Exit criterion:** Codex has an explicit Native BRep execution profile with the same canonical constraints as OpenCode.

---

## Phase D — Shared structured result diagnostics

### D1 — Preserve invalid-candidate diagnostics

The shared external-agent result parser must distinguish at least:

1. no structured result envelope was returned;
2. a structured envelope was returned without a project;
3. a project was returned but canonical normalization failed;
4. a normalized project was returned successfully.

Do not collapse case 3 into case 2.

Canonical normalization diagnostics should remain bounded and safe to return to the agent.

### D2 — Creation versus ordinary follow-up semantics

For first-turn Native BRep creation:

- a project is mandatory;
- message-only completion is not success.

For an ordinary follow-up where no CAD revision is genuinely required:

- a concise message-only answer may remain valid.

### D3 — Shared diagnostic formatting

Define one bounded diagnostic envelope usable by both OpenCode and Codex, for example conceptually:

```text
<pcad_brep_validation_failure>
attempt: 1
maxAttempts: N
<diagnostic>
AI BRep project candidate is invalid: ...
</diagnostic>
</pcad_brep_validation_failure>
```

The exact representation should follow current transport conventions.

**Exit criterion:** invalid structured BRep output is observable and repairable rather than silently becoming `project: undefined`.

---

## Phase E — Bounded repair parity across CLI and Streaming

### E1 — OpenCode CLI repair closeout

Reconcile and finish the already-started CLI bounded-repair path.

Required semantics:

```text
agent result
-> canonical parse/normalize
-> invalid
-> exact bounded diagnostic
-> resume same OpenCode session
-> corrected result
-> canonical parse/normalize
-> valid
-> synthesize build_brep_project
-> normal Brepia build validation
```

### E2 — Streaming OpenCode repair

Implement equivalent bounded repair in the persistent Streaming path.

Reuse the existing session and durable event cursor. Do not create a parallel unbounded loop.

### E3 — Server build rejection repair

After a syntactically/canonically parseable project becomes a real `build_brep_project` call, ordinary Brepia build validation remains authoritative.

A rejected build should provide the agent another bounded step with the real tool diagnostic.

An accepted build ends the CAD-repair loop.

### E4 — Exhaustion semantics

When the configured retry budget is exhausted:

- terminate cleanly;
- persist a meaningful failure status;
- expose the final diagnostic to the user/operator;
- do not save a fake canonical revision;
- do not enter `waiting_for_preview`.

### E5 — Semantic parity tests

Cover at minimum:

- invalid envelope -> repaired valid project;
- canonical normalization failure -> repaired valid project;
- repeated invalid result -> bounded terminal failure;
- server-side build rejection -> next model step;
- accepted build -> stop;
- CLI and Streaming equivalent outcome classes.

**Exit criterion:** CLI and Streaming have the same bounded Native BRep repair semantics.

---

## Phase F — Agent telemetry and verbose conversation progress

The existing inline generation panel is a baseline. This phase makes it diagnostically useful for long agentic runs.

### F1 — Persist agent/build attempt telemetry

Persist bounded structured events such as:

- external agent invocation number;
- canonical candidate received;
- canonical candidate rejected/accepted;
- normalization error code/message;
- `build_brep_project` attempt number;
- build accepted/rejected;
- model step number;
- transport repair count;
- current context usage where available.

Do not persist raw hidden reasoning.

### F2 — Conversation UI

The inline generation card should be able to show a human-readable sequence such as:

```text
Generating canonical project
Candidate 1 rejected — graph integrity
Repairing candidate
Candidate 2 accepted
Validating build
Build rejected — disconnected union
Repairing model
Build accepted
Preparing native preview
```

Keep the default presentation compact with an expandable verbose view.

### F3 — Reload/reconnect durability

The same progress must survive:

- browser reload;
- temporary disconnect;
- leaving and returning to the conversation;
- server-side durable generation state reconciliation.

**Exit criterion:** a long BRep agent run can be understood without reading server logs.

---

## Phase G — Context-growth measurement before compaction

Do not add compaction blindly. Measure what grows first.

### G1 — Measure per-step context

Capture at least:

- total model-message bytes/tokens;
- system/instruction budget;
- tool-schema budget;
- BRep project payload bytes/tokens;
- tool-result payload growth;
- external OpenCode session usage where reported;
- cumulative steps/repair attempts.

### G2 — Identify dominant growth class

Classify whether context growth is primarily:

- repeated canonical BRep snapshots;
- repeated tool diagnostics;
- conversation prose;
- transport instructions;
- external OpenCode session history;
- other duplicated state.

**Exit criterion:** context mitigation is chosen from measured evidence rather than assumptions.

---

## Phase H — Durable context ledger and safe compaction

Strictly lossless semantic compression of arbitrary natural-language history is not generally achievable. The goal is instead to preserve exact task-critical state while safely pruning redundant history.

### H1 — Define durable BRep work-state ledger

Maintain a compact machine/human-readable state containing exact values required to resume work, such as:

- current objective;
- hard invariants;
- active project/revision identity;
- current canonical project identity;
- important parameter/node IDs;
- current failure and exact error code/message;
- verified facts;
- rejected hypotheses;
- next concrete action;
- relevant model/transport identity.

Do not treat a prose summary as canonical CAD authority; the canonical BRep artifact remains source authority.

### H2 — OpenCode compaction integration

Evaluate current OpenCode compaction hooks/plugins against the measured context-growth profile.

Prefer selective pruning of redundant tool history over replacing the entire conversation with one lossy summary.

Any project-local integration must be reproducible and documented. Do not silently depend on an operator-global plugin for product correctness.

### H3 — Preserve critical data classes

Compaction must never discard the only copy of:

- canonical project source;
- stable project/node/parameter IDs required for follow-up continuity;
- unresolved validation errors;
- active task constraints;
- current revision/message identity needed by Brepia.

### H4 — Context regression fixture

Create a deterministic long-running BRep repair fixture capable of forcing context growth and verify that the agent can continue after compaction without identity drift or forgotten constraints.

**Exit criterion:** long agentic BRep sessions can continue within bounded context without relying on an unverifiable prose-only summary.

---

## Phase I — Electrical cabinet capability stress test

Only after the agent/repair/context path is stable should the complex model benchmark be rerun as evidence about the modeling language.

### I1 — Nominal benchmark

Create a parametric wall-mounted electrical control cabinet around nominal dimensions:

- width 800 mm;
- height 1200 mm;
- depth 300 mm;
- sheet thickness 2 mm.

Target features:

- hollow enclosure/open front;
- separate front door with clearance;
- hinges;
- handle/lock representation;
- internal mounting plate;
- three horizontal DIN rails;
- cable-entry opening;
- repeated ventilation openings.

The product prompt should describe design intent, not prescribe the canonical graph.

### I2 — Agent evidence capture

Record:

- exact prompt;
- model and transport;
- context usage;
- candidate/repair count;
- canonical normalization failures;
- build attempts and build errors;
- final node/parameter count;
- generation duration;
- resulting canonical project.

### I3 — Parameter perturbation

At minimum test:

```text
width: 800 -> 1000 mm
height: 1200 -> 1400 mm
sheet thickness: 2 -> 3 mm
```

Verify dependent geometry and design intent remain coherent.

### I4 — Native runtime evidence

If a canonical project is accepted:

- evaluate in the pinned native build123d/OCCT path;
- verify expected body/result semantics;
- export/import exact STEP where applicable;
- record failures without weakening semantics.

### I5 — Rhino/GHX only when warranted

Only continue into installed Rhino 8 / Grasshopper if the native model is structurally worth validating across the interop boundary.

**Exit criterion:** the cabinet has either succeeded under current capabilities or produced a clearly classified blocker.

---

## Phase J — Failure classification and next modeling-scope decision

Every observed cabinet failure must be classified before choosing a new canonical operation.

Allowed classes:

1. agent planning/spatial reasoning;
2. transport/result-contract problem;
3. context/compaction problem;
4. canonical validation/integrity problem;
5. native runtime/kernel problem;
6. UI/product lifecycle problem;
7. representable but materially pathological canonical graph;
8. genuine missing canonical modeling capability.

Only classes 7 or 8 justify activating a new geometry/modeling slice.

Potential candidates may include shell/thickness, multi-body/assembly result semantics, reusable profiles, sweep/path geometry or other operations, but none is preselected by this plan.

**Exit criterion:** publish a bounded post-stress-test scope decision with evidence for either the next canonical slice or an explicit decision that no new modeling opcode is needed.

---

## Recommended phase order

```text
A  Reconciliation / scope freeze
B  Dedicated OpenCode BRep agent
C  Dedicated Codex BRep profile
D  Shared structured diagnostics
E  CLI + Streaming bounded repair parity
F  Persisted verbose agent telemetry
G  Context-growth measurement
H  Durable context ledger / compaction
I  Electrical-cabinet stress test
J  Evidence-based next modeling decision
```

Phases B–E are the immediate active block. F–H make long agentic runs observable and sustainable. I–J then return to the actual modeling-capability question.

## New-chat handoff

A fresh chat should start from the current branch and first reconcile this document against implementation. The new chat should not assume every phase above is still open; completed work must be recognized from the branch and CI before changes are made.

Suggested minimal handoff:

```text
Continue `weaf/brepia` on `feature/brep-grasshopper-gh-packaging`.

Read and reconcile:
- `AGENTS.md`
- `docs/brep_native_agent_context_stress_plan_2026-09-15.md`
- the OpenCode/Codex/BRep runtime files referenced by Phase A.

Start at the first incomplete phase in the plan. Preserve all permanent boundaries. Keep PR #36 open, draft, stacked and unmerged. Create checkpoints and verify exact CI as each bounded phase closes.
```
