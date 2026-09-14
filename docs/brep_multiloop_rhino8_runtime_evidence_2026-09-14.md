# Bounded multi-loop profile extrusion — installed Rhino 8 / Grasshopper runtime evidence

Status: **Gate C partial — host-saved returned GHX strict validation PASS; visual host observations not yet separately recorded**

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

Gate A and Gate B are already accepted. The terminal result below is real returned-document evidence, but it does not by itself prove the visual host observations required by the Gate-C fixture.

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

The parameter perturbation locked by the fixture is:

```text
Plate width:        100 -> 120
Right-hole margin:   35 -> 40
Right-hole radius:    7 -> 9
```

The expected persisted returned parameters are therefore exactly:

```text
width=120
margin=40
holeRadius=9
```

The result remains ordinary Grasshopper Result **Item Access**.

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
- the returned parameters match `width=120`, `margin=40`, `holeRadius=9` because the test would fail otherwise;
- Result access remains Item Access;
- no script, component identity, port identity, graph-shape or other Brepia-owned executable mutation was accepted by the returned-document validator.

## Installed-host observations still requiring an explicit record

The fixture's full Gate-C boundary also requires installed Rhino 8 / Grasshopper observation of:

1. fresh GHX opens without repair prompts;
2. the solution produces exactly one solid Brep Result item;
3. both inner holes are visibly present;
4. the outer plate visibly widens after `width 100 -> 120`;
5. the expression-backed circular hole visibly moves after the width/margin perturbation;
6. the circular hole visibly grows after `holeRadius 7 -> 9`;
7. save -> close Rhino/Grasshopper -> reopen -> solve preserves the result.

Those visual/persistence observations were not separately stated in the terminal output supplied on 2026-09-14, so this document deliberately does not infer them from the passing validator alone.

## Current Gate-C conclusion

The returned-GHX part of Gate C is accepted.

The multi-loop slice must not yet be described as fully Gate-C accepted solely from this terminal result. A final explicit installed-host observation that the fresh/edited geometry looked correct and remained correct after save -> close -> reopen is still required before changing Gate C to complete.
