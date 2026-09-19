# Bounded planar 90-degree circular sweep implementation plan

Status: **PLANNED — implementation not started**

Date: 2026-09-19

Repository: `weaf/brepia`

Planning branch: `plan/brep-sweep-boundary`

Parent checkpoint:

```text
6d15a723a270022ada536219ec65f7fa0f7af0cf
Merge pull request #48 from weaf/fix/product-gap-login-readiness
```

Authority:

```text
docs/brep_post_product_gap_scope_decision_2026-09-19.md
docs/brep_sweep_implementation_boundary_2026-09-19.md
```

## Objective

Implement only the locked first sweep slice after the planning PR is accepted.

The implementation must close the target-E representational gap without turning Brepia's canonical schema into a general curve/sketch/sweep language.

Work in small independently verifiable checkpoints. Do not combine repository implementation, native acceptance, installed-Rhino evidence and product-path acceptance into one evidence claim.

## Phase S0 — planning closeout

Before source changes:

- commit the post-audit scope decision;
- commit the locked implementation boundary;
- record the reviewed Rhino 8 sweep references;
- keep all production source unchanged;
- run documentation/diff validation;
- open a planning-only PR against `master`.

Exit condition: the planning PR is green and reviewed/accepted. Only then create the implementation branch.

## Phase S1 — canonical contract

Add the bounded types and normalization:

- `BrepPlanarElbow90Path`;
- `BrepSweepNode`;
- `sweep` in the canonical node union;
- `single` value kind;
- no node dependencies;
- circle-only profile validation;
- X/Y/Z plane-normal validation;
- positive dimensions;
- strict `profile.radius < bendRadius`;
- default-parameter resolved validation.

Add focused contract tests before moving on.

Exit condition: valid S1 fixtures normalize deterministically and every explicitly unsupported field/form fails closed.

## Phase S2 — M0/M1, provider and editor integration

Integrate the four scalar-bearing fields with:

- parameter usage/effectiveness;
- runtime override validation;
- project editing without literalizing expression ASTs;
- provider Zod/JSON schema;
- Native BRep AI guidance;
- structural editor fields.

Keep provider expression depth unchanged.

Add regression coverage proving a Tube Diameter parameter can drive `profile.radius` through the existing scalar AST and Bend Radius remains independently effective.

Exit condition: canonical/provider/editor round-trips preserve expressions and no published sweep parameter can become decorative or orphan-only.

## Phase S3 — native build123d / OCCT translation

Implement the verified native construction:

- local XY first line;
- tangent `JernArc(..., 90)`;
- local XY second line;
- canonical Plane.XY / Plane.YZ / Plane.ZX mapping;
- start circle in the perpendicular section plane;
- one `sweep`;
- exactly one valid positive-volume solid.

Do not use `RadiusArc` as the elbow semantic shortcut.

Add X/Y/Z parity, nominal volume/path-length checks and invalid-radius regressions.

Exit condition: focused native translation tests are green in repository execution.

## Phase S4 — Rhino 8 / GHX translation

Compile the same canonical centerline/profile to RhinoCommon:

- explicit local rail construction in the locked U/V plane;
- one circle section at P0 in the locked V/N plane;
- Rhino 8 one-rail sweep API using document tolerance;
- planar end capping when required;
- exactly one closed solid Brep;
- Result Item;
- current placement semantics.

Update compiler/parity tests and strict returned-GHX expectations without broadening host trust.

Exit condition: generated source and GHX contract tests prove canonical parity; installed-host acceptance remains pending.

## Phase S5 — Gate A repository closeout

Run at minimum:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:browser-smoke
git diff --check
```

Also run every focused sweep/native/Rhino/compiler fixture introduced in S1–S4.

Exit condition: exact implementation checkpoint has green repository CI.

## Phase S6 — Gate B pinned native acceptance

From an isolated runtime/worktree:

- run the nominal target-E-equivalent fixture;
- perturb Bend Radius;
- perturb Tube Diameter/profile radius;
- verify X/Y/Z parity;
- verify invalid radius/length cases fail closed;
- require one solid;
- export exact STEP;
- independently re-import STEP in the pinned build123d/OCCT image;
- record geometry/cardinality/volume evidence in a dedicated native-runtime document.

Exit condition: Gate B evidence is committed separately from Gate A claims.

## Phase S7 — Gate C installed Rhino 8 / Grasshopper acceptance

Generate fresh GHX from the accepted implementation checkpoint and verify in installed Rhino 8:

- open and solve;
- one closed solid result;
- visible tangent 90-degree bend;
- Bend Radius perturbation;
- Tube Diameter perturbation;
- save -> close -> reopen;
- persisted parameter controls;
- strict returned-GHX validation.

Record installed-host evidence separately.

Exit condition: Gate C is committed without using Rhino evidence to override any native failure.

## Phase S8 — Gate D authenticated product-path acceptance

Use a dedicated Git worktree/runtime so unrelated builds cannot replace its `.output`.

Rerun the original target-E request through the normal authenticated Native BRep product path.

Required evidence:

- actual model id/execution mode;
- canonical export;
- canonical node histogram containing `sweep`;
- no box/cylinder substitution for the requested bend;
- native success with one solid;
- Bend Radius perturbation through the product UI;
- immutable revision save;
- screenshot and integrity manifest.

Exit condition: the same product family that selected the slice is now faithfully represented through the user-facing authoring path.

## Stop conditions

Stop implementation and return to scope/boundary review if any phase appears to require:

- arbitrary path point arrays;
- multiple bends;
- arbitrary bend angles;
- non-planar rails;
- reusable path/sketch graph values;
- non-circular or holed sweep profiles;
- twist/frame authoring;
- a new graph value kind;
- guide rails;
- topology identities;
- new scalar functions;
- weakening exact-one-solid semantics.

Do not widen the slice just to make a backend API easier to call.

## Closeout target

Only after S1–S8 are accepted may the implementation be described as closed.

The closeout must record Gate A/B/C/D separately and then return to a fresh product/scope decision. No broader sweep capability becomes active automatically.
