# Native BRep product-gap audit — execution status

Date: 2026-09-19

Repository authority: `master`

Decision authority: `docs/brep_post_phase9_multiloop_scope_decision_2026-09-14.md`

## Scope

The post-Phase 9 decision deliberately selected a bounded product-gap audit before any new canonical geometry opcode is implemented. The audit asks whether the current schema can model five representative product families faithfully and practically:

- A — hollow enclosure with openings and a lid interface;
- B — turned mechanical part;
- C — fabricated mounting plate / flange;
- D — architectural / cabinet layout;
- E — bent path-based object.

No shell/thickness, sweep, partial revolve, arbitrary-plane, reusable-sketch, chamfer, or other geometry implementation is authorized by this work. A new modeling slice can only be selected after captured product-path evidence demonstrates a concrete representational or material graph-pathology gap.

## 7A — repeatable product-path evidence harness

Status: implemented on the bounded audit branch; repository verification pending PR/CI.

The audit harness is intentionally separate from ordinary CI because it exercises the real configured Native BRep AI product path and therefore needs an authenticated local account plus a running Brepia/OpenCode/local-model stack.

Implemented files:

- `tests/brepProductGapAuditTargets.ts`
  - locks the five approved product targets and their exact prompts;
  - gives every target a published-parameter perturbation;
  - keeps target E explicitly tolerant of a truthful no-project outcome because path/sweep modeling is the hypothesis under test.
- `tests/brepProductGapAuditCorpus.test.ts`
  - guards the A–E corpus and canonical-boundary wording in the normal repository test gate.
- `tests/brep_product_gap.acceptance.ts`
  - signs in through the real product UI;
  - selects Native BRep on the normal creation surface;
  - submits the exact target prompt through `parametric-chat`;
  - records the actual model id and OpenCode execution mode from the product transport request;
  - waits for either a real BRep workspace or an explicit terminal creation outcome;
  - exports the product's canonical `.brepia-brep.json` package rather than reading a hidden privileged graph;
  - records node count, node-type histogram, published parameters, result kind and M0 integrity analysis;
  - rejects orphan nodes, orphan-only controls and unused controls for successful projects;
  - perturbs one published parameter through the normal editor UI;
  - captures the resulting native `/api/brep/evaluate` response and saves the parameter revision;
  - writes a bounded evidence manifest plus screenshot under `test-results/brep-product-gap/<target>/`.
- `playwright.brep-product-gap.config.ts`
  - isolates this real-runtime acceptance harness from fast deterministic CI Playwright smoke tests.
- `scripts/brep/product-gap-audit.sh`
  - runs exactly one target A–E against the configured live Brepia origin.

## Credentials and runtime

The harness does not store credentials. It accepts:

```bash
export BREPIA_GAP_IDENTIFIER='...'
export BREPIA_GAP_PASSWORD='...'
```

Existing Phase 9 `BREP_GHX_*` or B9 variables remain accepted as fallbacks so the same dedicated local acceptance account can be reused without introducing another account contract.

Default product origin:

```text
http://localhost:3000
```

Example execution:

```bash
scripts/brep/product-gap-audit.sh A
```

The harness refuses to start when the target is not A–E, credentials are absent, or Brepia is unreachable.

## Evidence contract

Each successful target manifest records:

- exact target prompt;
- conversation URL/id;
- actual product transport model id;
- actual OpenCode execution mode;
- visible generation status text when available;
- canonical project id/name/result node/result kind;
- total node count and node-type histogram;
- all published parameter ids/labels/defaults/units;
- complete `analyzeBrepProjectIntegrity()` result;
- native evaluation snapshots;
- selected perturbation and resulting evaluation evidence;
- whether the perturbation was persisted as a new immutable revision.

A terminal target records the same request/runtime evidence available before the failure plus a screenshot. A–D treat terminal creation as an audit failure. E allows it because a truthful refusal/failure to create the smooth path-based shape is itself relevant evidence; it must still be reviewed before classifying sweep as the next required slice.

## Classification remains manual and evidence-based

The harness deliberately does not auto-score or auto-select a new geometry feature. After each captured run, classify the target as:

1. representable and reasonable;
2. representable but materially pathological;
3. not faithfully representable.

For class 2, record the measurable pathology, including node count and dominant graph pattern. For class 3, record the exact unsupported requirement or forced approximation.

Only after all five targets have evidence should the separate implementation-boundary decision rank candidate slices under the selection rule in the post-Phase 9 scope decision.

## Current evidence state

### Target A — hollow enclosure with openings and lid interface

Status: **captured — current product path demonstrates a capability gap**.

The original authenticated Native BRep generation used `local/qwen3.6-35b-heretic-mtp-128k` and persisted the accepted canonical artifact in conversation `b3ca926f-c31d-4c16-a1e2-7c0a89485e01`. The accepted project is `Product Gap A Hollow Enclosure` with five published parameters.

The resumed evidence capture was rerun from a dedicated Git worktree at PR #48 checkpoint `0d4db896cb4670a8b0ce56f1e0e366c4b961c525`, with isolated build output and a separate stable-runtime port. The resume completed in about 9 seconds and saved:

- `a-canonical.brepia-brep.json`;
- `manifest.json`;
- `a-evaluation-failed.png`.

Canonical evidence:

- project id: `gap-a-hollow-enclosure`;
- result node: `result`;
- node count: 10;
- node histogram: 4 `box`, 3 `transform`, 2 `subtract`, 1 `union`;
- published parameters: Depth, Height, Opening Width, Wall Thickness and Width;
- all five parameters classify as effective;
- no orphan nodes;
- no orphan-only parameters;
- no unused parameters.

The authoritative native evaluation fails with:

```text
unsupported_result_cardinality: BRep union mergedBody produced 2 solids; exactly one is required
```

The captured `/api/brep/evaluate` response is HTTP 400. Because authoritative evaluation fails before a valid result body exists, the normal parameter perturbation/save-revision step is intentionally not attempted for this target.

Classification: **capability gap / not faithfully completed by the current product path**. The graph is canonical and internally reachable, but the requested enclosure plus lid-interface construction does not produce the required single authoritative solid under the accepted exact-one-body union semantics. This is product/capability evidence, not a browser-test failure. It does not by itself select shell/thickness or any other new opcode; candidate selection remains deferred until targets B–E are also captured and compared under the post-Phase-9 decision rule.

Operational finding: long-lived acceptance runtimes must not share a working tree whose `.output` can be replaced by unrelated builds. Use a dedicated Git worktree or otherwise isolated build output for every long-running product-gap capture.

### Target B — turned mechanical part

Status: **captured — native evaluation succeeds, but the generated product is semantically wrong**.

The authenticated generation completed in about 5.3 minutes using `local/qwen3.6-35b-heretic-mtp-128k` in OpenCode `cli` mode and persisted conversation `3be31faa-f560-4274-8a1e-1c9e748cf89d`.

Evidence capture saved:

- `b-canonical.brepia-brep.json`;
- `manifest.json`;
- `b-perturbed.png`.

Canonical/evaluator evidence:

- 4 reachable nodes: one `revolve`, one `cylinder`, one `transform`, one `subtract`;
- all three published parameters are effective;
- no orphan nodes, orphan-only parameters or unused parameters;
- native evaluation returns HTTP 200, `success`, `resultKind: single`, with no warnings;
- Outer Diameter perturbation 80 -> 90 evaluates successfully and is saved as a new immutable revision.

However, manual semantic inspection finds that the generated revolve profile violates the already locked profile-frame meaning. The accepted revolve contract defines profile `u` as axial and `v` as radial. The generated profile instead places `outerDiameter / 2` in `u` and the full `length` in `v`. The resulting nominal native bounds are therefore approximately `240 x 240 x 40 mm`; after changing Outer Diameter to 90 they become `240 x 240 x 45 mm`. For the requested nominal 120 mm long, 80 mm maximum-diameter shaft, this demonstrates that the named parameters affect geometry but not with their requested physical meaning.

Classification: **not faithfully completed by the current AI product path, but not a demonstrated canonical revolve-representation gap**. Full revolve plus Boolean composition remains capable of expressing the target under the locked `u = axial`, `v = radial` contract; this run instead exposes an authoring/semantic-correctness gap in how the product path constructs that canonical profile. It therefore does not justify partial revolve, multi-loop revolve or arbitrary-axis revolve as the next geometry slice.

Targets C–E remain pending and should be executed one at a time through the same isolated real-runtime evidence path.
