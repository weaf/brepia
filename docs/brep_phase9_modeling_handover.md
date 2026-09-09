# BRep Phase 9 / modeling capability handover

Use this as the starting context for the next focused agent/chat. Reconcile it against current branch implementation before changing code.

## Branch and merge boundary

Repository: `weaf/brepia`

Branch:

```text
feature/brep-grasshopper-gh-packaging
```

PR #36 remains **draft**, stacked on `feature/brep-grasshopper-smart-component`, and must not be merged across the Phase 7 boundary without explicit reconciliation.

Keep:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- strict parameter-only GHX return/import boundary;
- Rhino 8 built-in Python 3 as the zero-install executable carrier;
- Settings/discovery as the only LLM-model authority;
- OpenSCAD regressions unchanged;
- unsupported geometry operations fail closed;
- no installed-host parity claim without real Rhino 8 / Grasshopper evidence.

Do not use Codex unless it is genuinely needed.

## Latest functional/product checkpoints before this handover

Relevant recent branch history:

```text
19bd921b8577b8120da2561484d0841e9ba819ce  Record broader Rhino 8 GHX host acceptance
34004c406bbea4335fd9007dce33ec7951e69c0e  Cover ScrollArea width containment
335cc19f8e84bc576d6c4d781e8d5aca3fe47f52  Cover canonical local BRep runner wiring
f7edd338b0a722ce451984958e7b7e0228c20b95  Narrow Rhino fillets to canonical selector scope
```

The right Parameters panel width bug found with long feature/dependency text is fixed: Radix ScrollArea content is constrained to the selected panel width rather than expanding from intrinsic text width.

The canonical local launcher `./start.sh` now supplies the default local BRep runner when no explicit `PCAD_BREP_RUNNER` is configured.

## CI

The ScrollArea/product checkpoint was green:

- Quality Gate #714 — PASS;
- Grasshopper Build #286 — PASS.

Documentation commits after that checkpoint record the exact host-model audit and the future modeling plan. Confirm their current CI status before declaring the final branch checkpoint green.

## Installed Rhino 8 / Grasshopper evidence

The operator has now successfully opened two non-trivial fresh Brepia GHX definitions in the installed Rhino 8 / Grasshopper host.

Read:

- `docs/brep_phase9_rhino_acceptance.md`;
- `docs/brep_phase9_host_model_evidence_2026-09-09.md`;
- `docs/references/rhino8_mcneel_sources.md`.

Exact audited model evidence:

### Room project

Canonical graph uses boxes + literal transforms + one subtract with **eight** ordered cutters. This supplies real-host evidence for complex multi-node box/translation/subtract generation and eight-tool subtraction.

Important product defect found in the source snapshot: 10 published parameters but only 5 are referenced by result geometry. `cabinet_gap`, `cabinet_height`, `cabinet_width`, `door_height` and `wall_thickness` are published but disconnected. Numerous intended relationships are hard-coded literals, so even some connected room dimensions are not fully relational.

### Rectangular plate project

Canonical graph contains box, two cylinders, literal + parameter-backed translation, two-tool subtract and a fillet node.

This supplies real-host evidence for box, cylinder, translation, parameter-backed translation and multiple-cutter subtraction.

The fillet node is **not** `resultNodeId`; the authoritative result is the unfilleted `plate_with_hole`. A successful host solve is useful execution-level evidence that the fillet translation did not fail, but it is not sufficient visual/topological fillet-Result acceptance. Do not overclaim it.

`rotateDeg` is `[0,0,0]`, so rotation remains unaccepted.

The plate also exposes ineffective parameters: `hole_diameter`, `parameter`, `parameter2`, plus `fillet_radius` does not affect the authoritative Result because the fillet branch is orphaned from `resultNodeId`.

## Remaining Phase 9 acceptance

Do not confuse richer modeling work with completion of the existing GHX product loop.

Still separately required:

1. dedicated authoritative fillet Result host test if fillet parity is to be claimed;
2. non-zero rotation analysis + implementation + host test before enabling rotation;
3. Grasshopper save/reopen evidence;
4. returned Rhino-saved GHX import to Brepia;
5. verify deterministic compatibility validation and parameter recovery;
6. activate the imported immutable revision;
7. verify native Brepia preview;
8. continue editing with Brepia AI;
9. export a fresh GHX again and open/solve it in Grasshopper.

## New modeling-capability track

Read `docs/brep_modeling_capability_expansion_plan.md`.

The main product limitation is now clear: canonical schema v1 is too weak to express ordinary relational modeling cleanly. AI therefore tends to emit Boolean-heavy box constructions with baked literals and can publish sliders that do not reach authoritative geometry.

Recommended order:

### M0 — parameter effectiveness + orphan graph analysis

Implement first. Shared deterministic analysis should classify:

- authoritative-result/role-reachable nodes;
- orphan nodes;
- effective parameters;
- semantic-only parameters;
- orphan-only parameters;
- unused parameters.

For AI-created/AI-edited projects, stop persisting fake geometry sliders and unintended orphan finishing branches. Prefer an AI-boundary validation/repair contract rather than making old imported/manual v1 files globally invalid immediately.

This should catch both real audited examples:

- Room: five published but disconnected parameters;
- Plate: three totally unused parameters plus a fillet parameter attached only to an orphan result branch.

### M1 — bounded scalar expression AST

The current `BrepScalar = number | { parameter }` cannot represent derived relationships. Introduce a deterministic, unit-checked expression AST rather than strings/code so ordinary formulas such as half-height, wall offsets and repeated spacing remain parametric.

Keep GHX round-trip parameter-only: Grasshopper edits published inputs, not the canonical expression graph.

### M2+ — richer geometry vocabulary

After M0/M1:

- union/intersection;
- linear pattern/mirror;
- bounded profile + extrusion;
- only then evaluate whether dedicated wall/plate/shell semantics are still needed.

Every new operation must be implemented first in canonical/native build123d semantics, then translated to Rhino/GHX with branch-8 McNeel reference review and real host acceptance.

## Suggested next chat first action

Begin with **analysis and scope for M0 only**, while keeping the Phase 9 acceptance list open.

Inspect:

- `shared/brepProject.ts`;
- `shared/brepProjectEditing.ts` and existing parameter-usage helpers;
- `shared/brepAiProject.ts`;
- `src/server/brepAiTurn.ts`;
- native evaluator dependency/scalar resolution;
- GHX compiler parameter collection;
- relevant BRep AI creation/follow-up tests.

Determine the narrowest shared graph/parameter-effectiveness API and where AI-created/edited snapshots should reject or repair ineffective public parameters without breaking legacy/manual/imported v1 projects.

Do not begin M1 expression-schema changes until M0 is repository-complete and accepted.
