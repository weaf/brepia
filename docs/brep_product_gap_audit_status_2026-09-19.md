# Native BRep product-gap audit — execution status

Date: 2026-09-19

Repository authority: `master`

Original audit authority: `docs/brep_post_phase9_multiloop_scope_decision_2026-09-14.md`

Post-audit scope decision: `docs/brep_post_product_gap_scope_decision_2026-09-19.md`

## Scope

The post-Phase 9 decision deliberately selected a bounded product-gap audit before any new canonical geometry opcode is implemented. The audit asks whether the current schema can model five representative product families faithfully and practically:

- A — hollow enclosure with openings and a lid interface;
- B — turned mechanical part;
- C — fabricated mounting plate / flange;
- D — architectural / cabinet layout;
- E — bent path-based object.

No shell/thickness, sweep, partial revolve, arbitrary-plane, reusable-sketch, chamfer, or other geometry implementation is authorized by this work. A new modeling slice can only be selected after captured product-path evidence demonstrates a concrete representational or material graph-pathology gap.

## 7A — repeatable product-path evidence harness

Status: **complete and merged to `master` through PR #48 (`6d15a723a270022ada536219ec65f7fa0f7af0cf`)**.

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

### Target C — fabricated mounting plate / flange

Status: **captured — representable with the accepted modeling surface; finishing is not a blocker**.

The authenticated generation completed in about 3.1 minutes using `local/qwen3.6-35b-heretic-mtp-128k` in OpenCode `cli` mode and persisted conversation `99fb45c3-8b0c-450e-9b63-80d997ecadb5`. The first candidate was correctly rejected for an unused `boltCircleDiameter`; the second candidate passed graph-integrity validation.

Evidence capture saved:

- `c-canonical.brepia-brep.json`;
- `manifest.json`;
- `c-perturbed.png`.

Canonical/evaluator evidence:

- 5 reachable nodes: one multi-loop `extrude`, one `cylinder`, one `transform`, one `circularPattern`, one `subtract`;
- the plate extrusion contains a central circular hole loop;
- six bolt cutters are produced by one true circular pattern and subtracted from the plate;
- no fillet node was added, consistent with the prompt's instruction to omit finishing if the current semantic selector could not express it safely;
- all published parameters are effective and there are no orphan nodes, orphan-only parameters or unused parameters;
- native evaluation returns HTTP 200, `success`, `resultKind: single`, with nominal bounds approximately `240 x 160 x 12 mm` and no warnings;
- Bolt Circle Diameter perturbation 140 -> 160 evaluates successfully and is saved as a new immutable revision.

Manual authoring review notes two non-blocking semantic choices: the model also published Plate Depth and Plate Thickness beyond the three explicitly requested controls, and it derived the unspecified central-opening radius as `boltCircleDiameter / 4`, so the BCD control also changes that opening. These are product-authoring quality considerations rather than missing geometry capabilities.

Classification: **representable and reasonable at the canonical geometry level**. The target demonstrates that multi-loop extrusion, circular pattern and Boolean subtraction cover the functional flange/plate requirement. The optional 5 mm fillet can be omitted without compromising the requested authoritative geometry, so this evidence does not justify a new finishing/topology slice.

### Target D — architectural / cabinet layout

Status: **captured — the current AI product path fails semantically, but no canonical representation gap is demonstrated**.

The authenticated generation completed in about 12.9 minutes using `local/qwen3.6-35b-heretic-mtp-128k` in OpenCode `cli` mode and persisted conversation `15f0ef16-7548-4d87-ae0f-dee63bcd3410`.

Evidence capture saved:

- `d-canonical.brepia-brep.json`;
- `manifest.json`;
- `d-evaluation-failed.png`.

Canonical/evaluator evidence:

- 19 reachable nodes: 7 `box`, 9 `transform`, 2 `union`, 1 `subtract`;
- all five requested parameters are effective;
- no orphan nodes, orphan-only parameters or unused parameters;
- native evaluation returns HTTP 400 with `unsupported_result_cardinality: BRep union carcassFrame produced 3 solids; exactly one is required`;
- the graph contains no `linearPattern`, `rectangularPattern` or `circularPattern` node.

Manual semantic inspection shows two independent authoring failures. First, the generated `carcassFrame` attempts to union the two sides, top, bottom and back into one authoritative body but places them such that the native union yields three disconnected solids. Second, the three shelves are represented by three manual `transform` nodes over one shelf box rather than the explicitly requested supported pattern operation.

Classification: **not faithfully completed by the current AI product path, but not a demonstrated canonical cabinet/orthogonal-construction gap**. The accepted language already provides scalar-derived dimensions, transforms, Boolean composition and `linearPattern`; the failed run did not use that surface correctly. The exact-one-body union failure is therefore product-path authoring evidence rather than proof that a new geometry operation is required.

### Target E — bent path-based object

Status: **captured — concrete path/sweep representational gap demonstrated**.

The authenticated generation completed in about 4.4 minutes using `local/qwen3.6-35b-heretic-mtp-128k` in OpenCode `cli` mode and persisted conversation `de6b5f85-556f-4c9c-a30b-8f18c7416573`. The first candidate was correctly rejected because both published parameters were unused; the second candidate passed graph-integrity validation.

Evidence capture saved:

- `e-canonical.brepia-brep.json`;
- `manifest.json`;
- `e-perturbed.png`.

Canonical/evaluator evidence:

- 5 reachable nodes: 2 `box`, 1 `cylinder`, 2 `union`;
- both published parameters classify as effective and there are no orphan nodes or unused parameters;
- native evaluation returns HTTP 200, `success`, `resultKind: single`, with no warnings;
- Bend Radius perturbation 150 -> 180 evaluates successfully and is saved as a new immutable revision.

The successful native evaluation is not semantic acceptance. Manual inspection of the canonical graph shows that `first_leg` and `second_leg` are square-section boxes, `bend` is a straight cylinder whose radius is driven directly by `bendRadius`, and there are no transforms that make the two legs perpendicular. The graph contains no path or sweep representation and no true tangent 90-degree centerline bend. It therefore violates the target's explicit requirement for a constant circular section following true defining path geometry, as well as the prohibition on box/cylinder approximation.

The nominal evaluation bounds are approximately `300 x 300 x 1000 mm`; changing Bend Radius to 180 changes them to approximately `360 x 360 x 1000 mm`. That proves the parameter is mechanically effective in the accepted graph, but it changes the radius of the fabricated straight cylinder rather than the requested centerline bend radius.

Classification: **not faithfully representable by the current accepted canonical surface under this target boundary**. The product path produced a graph that is structurally valid but semantically substitutes unrelated primitives for the requested smooth path-defined object. This is the concrete representational failure the audit was designed to detect.

## Audit closeout

All five approved targets A–E now have real authenticated product-path evidence captured through the isolated acceptance runtime.

The evidence does not justify shell/thickness, partial or arbitrary-axis revolve, richer finishing/topology, or a new cabinet/assembly primitive:

- A exposes an exact-one-body/authoring failure for the generated enclosure graph but does not by itself prove that shell/thickness is required;
- B exposes incorrect revolve profile semantics in AI authoring while the accepted full-revolve surface remains sufficient;
- C is representable and reasonable with the existing multi-loop, pattern and Boolean surface;
- D exposes incorrect cabinet placement/composition plus failure to use the existing pattern operation;
- E is the concrete representational failure: the current canonical language has no faithful path/sweep representation for the requested smooth tangent bent constant-section object.

Under the post-Phase-9 scope decision, this audit therefore establishes **path/sweep modeling as the candidate for the next bounded implementation-boundary decision**. No new canonical opcode is activated by this status document itself; the next step is a separate decision that defines the minimum path grammar, frame/twist semantics, self-intersection rules and native/Rhino parity boundary before implementation begins.
