# Bounded multi-loop profile extrusion — installed Rhino 8 / Grasshopper runtime evidence

Status: **Gate C accepted — installed Rhino 8 / Grasshopper runtime PASS**

Date: 2026-09-14

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Evidence boundary

This document records only the installed-host / returned-GHX evidence for bounded multi-loop profile extrusion.

The three evidence layers remain separate:

```text
Gate A: repository / CI
Gate B: pinned native build123d / OCCT
Gate C: installed Rhino 8 / Grasshopper
```

Gate A and Gate B were already accepted before this run. Gate C below combines real installed-host observation with strict returned-document validation; repository CI is not used as a substitute for host evidence.

## Gate-C fixture

The installed-host fixture is generated and validated by:

```text
tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts
```

The host workflow uses:

```text
multiloop-extrude-plate.ghx
multiloop-extrude-plate-host-saved.ghx
```

The locked parameter perturbation is:

```text
Plate width:        100 -> 120
Right-hole margin:   35 -> 40
Right-hole radius:    7 -> 9
```

Expected persisted returned parameters:

```text
width=120
margin=40
holeRadius=9
```

The result remains ordinary Grasshopper Result **Item Access**.

## Installed Rhino 8 / Grasshopper observation

The fixture was exercised in the installed Rhino 8 / Grasshopper host.

The user explicitly confirmed the final required host observation on 2026-09-14:

- the edited model looked correct in Rhino;
- both inner holes were present;
- after save -> close Rhino/Grasshopper -> reopen, the model still solved/displayed correctly;
- both holes and the expected edited geometry remained intact after reopen.

This supplies the host-persistence observation that cannot be established by repository tests or returned-GHX parsing alone.

Combined with the locked acceptance edit and the strict persisted parameter values below, the installed-host run covers the intended multi-loop plate after the width, right-hole margin and right-hole radius perturbations.

## Strict returned-GHX validation

The host-saved file was supplied back to the strict returned-document validator through:

```bash
BREPIA_MULTILOOP_RHINO_SAVED_DIR=test-results/multiloop-rhino-acceptance \
  npx vitest run tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts
```

Observed output:

```text
v4.1.11 /home/thn/ai/pCAD

 ✓ tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts (2 tests) 24ms
   ✓ bounded multi-loop installed Rhino 8 acceptance fixture (2)
     ✓ compiles and strictly validates a fresh multi-hole Item-access GHX fixture 18ms
     ✓ strictly validates a Rhino-saved parameter-only GHX when requested 4ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

This establishes that:

- the current compiler still produces a fresh multi-hole GHX accepted by the strict generated-document validator;
- the returned host-saved GHX is accepted by the strict returned-document validator;
- the returned file preserves the expected parameter-only mutation boundary;
- the returned parameters are exactly `width=120`, `margin=40`, `holeRadius=9`;
- Result access remains Item Access;
- no script, component identity, port identity, graph-shape or other Brepia-owned executable mutation was accepted by the returned-document validator.

## Rhino compiler path exercised

The accepted multi-loop definition exercises the current built-in Rhino 8 Python 3 carrier and the bounded planar-region extrusion path:

```text
canonical outer profile curve
+ canonical translated inner profile curves
-> Rhino.Geometry.Brep.CreatePlanarBreps(curves, tolerance)
-> require exactly one Brep region
-> require exactly one face
-> require exactly 1 + holeCount loops
-> BrepFace.CreateExtrusion(centered axis path, true)
-> require one valid solid Brep
-> Result Item
```

No Rhino BooleanDifference is used to encode canonical profile holes.

## Preserved bounded contract

Gate C does not broaden the canonical surface. The accepted contract remains:

- canonical `schemaVersion: 1` unchanged;
- existing single-loop rectangle/circle/closedPolyline extrusion unchanged;
- optional ordered non-recursive holes;
- maximum 8 holes;
- rectangle, circle and closedPolyline loop families only;
- maximum 32 points per closedPolyline;
- maximum 128 explicit closedPolyline points across outer + holes;
- hole offsets use M1 millimetre scalar/expression semantics;
- holes remain extrusion-only;
- strict inside/separation rules remain fail-closed;
- exactly one positive-volume `single` result;
- build123d/OCCT remains geometry authority;
- Rhino/GHX remains interoperability compiler/runtime evidence;
- GHX return remains parameter-only.

## Gate C conclusion

Gate C is accepted.

Bounded multi-loop profile extrusion is now accepted across all three required evidence layers:

1. repository / CI;
2. real pinned rootless build123d / OCCT runtime with exact STEP re-import;
3. installed Rhino 8 / Grasshopper runtime with edited geometry, save -> close -> reopen persistence, and strict returned-GHX parameter-only validation.

The bounded multi-loop profile extrusion slice is therefore fully accepted without changing its locked canonical boundary.
