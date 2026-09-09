# BRep M1 scalar expression closeout

Status: **repository-complete and CI-accepted for M1**. Installed Rhino 8 / Grasshopper host acceptance for the new derived-expression behavior remains a separate evidence boundary.

Date: 2026-09-09

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

M1 code checkpoint:

```text
4ebfa486519c23d03996c514c326a2f2fff0e084
Remove stale M1 scalar editing import
```

CI on that exact code checkpoint:

- Quality Gate #751 — **PASS**;
- 126 test files — **PASS**;
- 808 tests — **PASS**;
- dependency audit — **PASS**;
- TypeScript typecheck — **PASS**;
- ESLint with zero warnings — **PASS**;
- production build — **PASS**;
- `git diff --check` — **PASS**;
- Grasshopper Build #323 — **PASS**;
- Grasshopper plugin test/build on Ubuntu — **PASS**;
- Grasshopper plugin build on Windows — **PASS**.

## Scope accepted

M1 extends canonical `schemaVersion: 1` additively. Existing numeric literals and direct published-parameter references remain valid and require no migration.

Canonical scalar values may now be:

```ts
type BrepScalar =
  | number
  | { parameter: string }
  | { op: 'add' | 'sub' | 'mul' | 'div'; args: [BrepScalar, BrepScalar] }
  | { op: 'neg'; args: [BrepScalar] };
```

This is a bounded data AST, not a source-code or arbitrary-expression facility.

Accepted safety limits:

- maximum absolute literal, parameter or intermediate scalar value: `1e9`;
- maximum expression depth: `12`;
- maximum expression-node count: `64`;
- every intermediate must remain finite and bounded;
- division by zero fails closed;
- malformed operators and arity fail closed;
- undeclared parameter references fail closed.

The depth and node-count bounds have separate regression coverage so a shallow but excessively wide tree cannot bypass the expression-size limit.

## Unit semantics

M1 uses deterministic unit-aware validation over `mm`, `deg` and `none`.

- numeric literals are contextually typable;
- `add` and `sub` require compatible equal dimensions;
- `mul` permits dimensionless scaling only: `none * X` or `X * none`;
- `div` permits `X / none -> X` and same-dimension division `X / X -> none`;
- implicit derived dimensions such as `mm * mm` and `deg * mm` are rejected.

This allows ordinary derived relationships without introducing an unrestricted formula language.

## Canonical and runtime validation

Canonical normalization validates expression structure, parameter references, units and evaluation under published parameter defaults.

M1 also validates the complete project scalar set again after effective runtime parameter overrides have been resolved and **before native execution**. Therefore a project that is valid under defaults still fails deterministically before the native sandbox if a runtime override causes, for example:

- a zero divisor;
- an intermediate overflow/non-finite value.

This closes the gap between default-time schema validation and slider-driven/runtime evaluation.

## Native build123d / OCCT parity

The native BRep driver evaluates the same bounded operator set:

- `add`;
- `sub`;
- `mul`;
- `div`;
- `neg`.

The driver enforces the same finite/bounded intermediate semantics and division-by-zero rejection before geometry operations are performed.

build123d/OCCT remains the authoritative native geometry evaluator.

## Rhino / GHX compiler parity

The Rhino/GHX compiler translates canonical scalar ASTs to generated bounded Python helper calls rather than arbitrary generated expression source. The generated carrier enforces finite/bounded values and division-by-zero failure.

Published Grasshopper controls remain only the canonical published numeric parameters. Derived expression nodes do **not** become additional GH controls.

The supported GHX return/import boundary therefore remains parameter-only: Grasshopper may return changed published numeric input values, while the canonical expression graph remains Brepia source authority.

## Rotation remains fail closed

M1 does not enable rotation parity.

The Rhino compiler still accepts only literal numeric zero for `transform.rotateDeg`. A scalar expression that mathematically resolves to zero is intentionally rejected as `unsupported_model`.

A dedicated regression verifies this boundary. Non-zero rotation remains M6 work and requires its own convention analysis, implementation and installed-host acceptance.

## M0 integration

The M0 graph/parameter-integrity layer now follows published-parameter references recursively through scalar expressions.

Consequently an input used inside a derived expression is still classified correctly as effective or semantic-only depending on the authoritative dependency path. Parameter-usage/deletion protection likewise follows nested expression references.

M1 therefore preserves the M0 product rule that a published geometry parameter is a product promise and must reach an authoritative output.

## Editor behavior

M1 deliberately implements **expression-preserving, not free-form expression-authoring** UI behavior.

The placement, feature and project-object scalar editors now distinguish:

1. literal values;
2. direct published-parameter references;
3. derived expression ASTs.

An existing AST is displayed as a read-only derived expression and is preserved unless the user deliberately switches the field to a literal or a published parameter. Merely opening, viewing or saving the editor does not flatten the AST into a numeric value or incorrectly treat it as a direct parameter reference.

Dedicated regression coverage locks this behavior across all three scalar editors.

## AI contract

`build_brep_project` now exposes and documents the bounded M1 AST.

The model is instructed to:

- use the AST for genuine derived relationships;
- publish independent user-facing inputs rather than duplicate/fake dependent sliders;
- respect the M1 unit algebra;
- avoid zero divisors and unbounded trees;
- never emit source strings, `eval`, arbitrary functions, arbitrary variables or other executable expression forms;
- keep rotation absent or literal zero until M6.

For example, a relationship such as:

```text
innerWidth = overallWidth - 2 * wallThickness
```

is represented canonically as a derived AST rather than a synthetic `innerWidth` published slider.

The AI boundary has explicit regression coverage for accepting the bounded AST and rejecting source-like expression payloads.

## Key regression coverage

Relevant focused coverage includes:

- `tests/brepScalarExpressions.test.ts` — compatibility, arithmetic, units, malformed ASTs, depth, default division/overflow and M0 nested-reference behavior;
- `tests/brepScalarExpressionNodeLimit.test.ts` — independent 64-expression-node bound;
- `tests/brepProvider.test.ts` — runtime override division-by-zero and overflow rejection before provider execution;
- `tests/brepAiTool.test.ts` — bounded AI AST acceptance and source-like expression rejection;
- `tests/brepScalarExpressionUi.test.ts` — expression-preserving editor contract;
- `tests/brepGrasshopperComplexGraph.test.ts` — Rhino scalar-expression translation in a non-trivial graph;
- `tests/brepGrasshopperRhinoScript.test.ts` and `tests/brepGrasshopperExecutableGhx.test.ts` — bounded generated scalar helper expectations;
- `tests/brepGrasshopperRotationExpressionBoundary.test.ts` — M1 does not unlock expression-backed rotation.

The full Quality Gate confirms that pre-existing OpenSCAD, BRep lifecycle, AI, native evaluation, GHX import/export and product regressions remain green.

## Authority and compatibility invariants preserved

M1 does not change these accepted boundaries:

- `conversation.type = 'parametric'`;
- explicit Native BRep routing through `parametricSourceKind = 'brep'`;
- canonical BRep project + immutable revision authority;
- canonical `schemaVersion: 1` remains the persisted contract;
- build123d/OCCT remains authoritative native geometry;
- Rhino/GHX remains an interoperability compiler;
- GHX return/import remains strict parameter-only at the supported round-trip boundary;
- unsupported modeling operations continue to fail closed;
- non-zero rotation remains unsupported;
- OpenSCAD behavior remains unchanged.

## Branch / PR reconciliation at the code checkpoint

The M1 code checkpoint was reconciled against the intended stacked base:

```text
base: 87c134c0248d362192ccdc654aa3f85757144489
head: 4ebfa486519c23d03996c514c326a2f2fff0e084
behind_by: 0
merge_base: 87c134c0248d362192ccdc654aa3f85757144489
```

PR #36 remains the draft stacked PR for `feature/brep-grasshopper-gh-packaging` over `feature/brep-grasshopper-smart-component`. M1 closeout does not authorize merging it across that boundary.

## Installed Rhino 8 host acceptance still open

Repository acceptance proves deterministic canonical/native/compiler behavior but is not presented as new installed-host evidence for M1 expressions.

A focused host fixture should exercise a real derived relation such as:

```text
Width = 1500
WallThickness = 50
InnerWidth = Width - 2 * WallThickness
```

Installed-host acceptance should verify:

1. a fresh Brepia-generated GHX opens and solves in Rhino 8 / Grasshopper;
2. only `Width` and `WallThickness` are published controls for that relationship;
3. changing either input updates the solved Rhino geometry according to the derived expression;
4. save/reopen preserves the solve;
5. returned GHX import recovers only changed published numeric parameter values;
6. the canonical AST remains unchanged Brepia source authority;
7. the imported immutable revision can be explicitly activated and evaluated natively again.

This host evidence belongs to the existing Phase 9 host-acceptance track and must not be inferred merely from repository CI.

## Deliberately not started

M1 did **not** start:

- M2 `union` / `intersect` Boolean expansion;
- new modeling-node families;
- pattern/mirror work;
- profile/extrusion work;
- shell/wall abstractions;
- non-zero rotation support;
- broader topology/fillet-selector expansion.

The next modeling milestone is M2 only after a separate scope decision. The existing Phase 9 installed-host acceptance list remains independently open.
