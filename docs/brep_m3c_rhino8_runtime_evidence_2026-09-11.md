# M3C — installed Rhino 8 / Grasshopper runtime evidence

Status: **accepted**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

This evidence closes the installed-host acceptance boundary for M3C bounded rectangular pattern.

The fresh GHX fixtures were generated from the M3C compiler/fixture checkpoint:

```text
5c2d11c3b9bea97b2d6a6c50d296c9c371c25af0
Keep M3C Rhino cutter grid inside host fixture
```

That exact checkpoint had already passed repository CI separately:

```text
Quality Gate #1034       PASS
Grasshopper Build #606  PASS
```

Repository CI is not treated as installed-host evidence. The acceptance below was performed separately in installed Rhino 8 / Grasshopper.

After the host run exposed that the acceptance wrapper unnecessarily required one particular perturbation (`25/35`), the wrapper and its test were relaxed to accept any bounded non-default published values while preserving the strict returned-GHX structural validator. The resulting validation-tool checkpoint was:

```text
fd07d9ea885a6454c2bcef3f08e4bcd786febf47
Make M3C Rhino expected values optional
```

The compare from `5c2d11c3...` to `fd07d9e...` changes only:

```text
scripts/brep/m3c-rhino-acceptance.sh
tests/brepM3CRhinoAcceptanceTool.test.ts
```

It does not change the M3C canonical model, GHX compiler, fixture generator or geometry semantics.

## Fresh installed-host fixtures

The accepted definitions were:

```text
m3c-final-rectangular-pattern.ghx
m3c-rectangular-pattern-cutters.ghx
```

Both were produced by the repository M3C fixture generator from the current compiler rather than by hand-editing GHX.

The published controls are:

```text
pitchA       default 20 mm
pitchBaseB   default 25 mm
spacingB     = pitchBaseB + 5 mm
```

The controls remain bounded by the canonical fixture contract.

## Final rectangular-pattern acceptance

The final-pattern definition was accepted in installed Rhino 8 / Grasshopper with the following observed behavior:

- the GHX file opened successfully;
- the definition solved successfully;
- `rectangularPattern` was exposed through **Result List Access**;
- the result contained six separate Breps, not an implicit Boolean union;
- the initial 2 x 3 placement followed the canonical two-axis rectangular pattern;
- changing the published spacing control recomputed the repeated geometry;
- the modified definition was saved, closed and reopened successfully;
- the persisted changed value remained present after reopen;
- the Rhino-saved returned GHX passed strict returned-GHX validation.

The first strict validation attempt also independently demonstrated that Rhino had persisted a real non-default parameter value:

```text
Expected pitchA=25, got 36.
```

That failure was caused only by the acceptance wrapper's over-specific expected value. It proves that the returned GHX contained `pitchA=36`, rather than the generated default `20`. The structural validator had correctly read the host-saved value.

The wrapper was then corrected so that acceptance requires a bounded non-default perturbation rather than one hard-coded numeric choice. Revalidation passed.

## Rectangular pattern as subtract cutters

The second definition was accepted in installed Rhino 8 / Grasshopper with the following observed behavior:

- the GHX file opened successfully;
- the definition solved successfully;
- the rectangular `instanceSet` was consumed through `subtract.tools[]`;
- the final result was one Brep through **Result Item Access**;
- the 240 x 240 plate contained six cylindrical through-cuts in the 2 x 3 rectangular arrangement;
- changing the published spacing controls recomputed the cutter placement;
- the modified definition was saved, closed and reopened successfully;
- the persisted definition solved again after reopen;
- the Rhino-saved returned GHX passed strict returned-GHX validation.

This preserves the existing collection boundary: the rectangular pattern may be a final `instanceSet` or an ordered subtract-tool source, but it is not silently fused and does not become a general collection operand.

## Returned-GHX security boundary

The acceptance-wrapper correction does not weaken the parameter-only return boundary.

The returned validator continues to reject unsupported changes to, among other things:

- Python script/source identity;
- component identity;
- graph shape;
- wiring;
- published-control identity/type;
- Result Item/List access;
- unsupported structural mutations;
- parameter values outside the canonical bounds.

For this host acceptance, both returned definitions also had to contain a real non-default published-value perturbation. Exact expected values remain optionally enforceable by the acceptance utility when a test requires them.

## Native parity already accepted

The same M3C contract had already passed the real pinned build123d / OCCT runtime independently. That evidence is recorded in:

```text
docs/brep_m3c_native_runtime_evidence_2026-09-11.md
```

The native run verified six ordered bodies with stable `pattern::0..5` identities, row-major A-outer/B-inner offsets, parameter/expression-backed spacing, exact STEP, and rectangular pattern consumption as ordered subtract tools while the final subtract remained exactly one `single` body.

## Preserved architecture

This host acceptance does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep plus immutable revision authority;
- build123d / OCCT geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter-effectiveness policy;
- M1 canonical scalar depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean policy;
- M3B `single | instanceSet` result kinds;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ `R = Rx * Ry * Rz`, `p' = R*p + T`;
- GHX parameter-only return/import semantics;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 finishing/topology deferral.

## Conclusion

M3C installed Rhino 8 / Grasshopper acceptance is **complete**.

Together with the repository/CI implementation evidence and the separate real build123d / OCCT runtime evidence, all required M3C acceptance layers are now closed.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
