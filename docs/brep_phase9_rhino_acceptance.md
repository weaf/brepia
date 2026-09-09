# BRep Phase 9 — installed Rhino/Grasshopper acceptance

## Status

**In progress with real installed-host evidence.**

Phase 9 is intentionally separated from Phase 8 because repository CI cannot prove installed Rhino 8 / Grasshopper runtime behavior.

Phase 8 is repository-complete through the strict GHX export/import boundary. Phase 9 supplies the real-runtime interoperability evidence and feeds narrowly scoped host-compatibility fixes back into the GHX compiler when required.

## Current installed-host evidence — 2026-09-09

Real Rhino 8 / Grasshopper testing has now established the following:

1. The original reduced hand-written executable GHX envelope did **not** open in the installed host. Grasshopper IO reported `Object reference not set to an instance of an object` before the definition was usable.
2. Removing the embedded executable component did not remove that error, which isolated the first defect to the GHX document/archive envelope rather than the model script itself.
3. Moving the same Brepia objects into an envelope derived from a Grasshopper-saved document opened successfully.
4. A built-in Rhino 8 **Python 3 Script** component, using `RhinoCodePluginGH`, opened without installing `Brepia.Grasshopper.gha`.
5. A focused Python 3 diagnostic with Height/Width inputs and a Result Brep solved successfully, displayed the expected box and loaded quickly in the installed host once the Python source identifiers exactly matched the runtime-visible serialized port names.
6. The production GHX compiler was then updated to the fuller host-compatible envelope plus the built-in Python 3 carrier. A fresh GHX exported by Brepia now opens successfully in the installed host, proving that the product export no longer fails at the Grasshopper IO boundary.
7. That first fresh product export exposed a second, narrower runtime defect: its canvas ports were `Height`, `Width` and `Plane`, but its embedded Python source still referenced the old internal identifiers `brepiaP0`, `brepiaP1` and `brepiaPlacement`. Rhino therefore loaded the component but could not solve it.
8. The production script plan has now been corrected so serialized Python port names and generated source identifiers are the same deterministic names. For the current box fixture this means `Height`, `Width`, `Plane` inputs and `Result`, `Footprint`, `Clearance`, `Maintenance`, `Connections`, `Mounting`, `Cable`, `Metadata` outputs. The old `brepiaP*`/`brepiaPlacement` names are regression-tested as forbidden in generated source.

Current code checkpoint for the runtime-port correction:

```text
abc9537ad97305817126776e1d96e76348fb98c7
Satisfy Rhino Python port lint gate
```

Exact-head repository evidence:

- Quality Gate #687 — PASS;
  - dependency audit PASS;
  - tests PASS;
  - typecheck PASS;
  - lint PASS;
  - build PASS;
  - diff check PASS;
- Grasshopper Build #259 — PASS;
  - plugin build PASS;
  - Ubuntu package PASS;
  - Windows package PASS.

This is still **partial Phase 9 evidence**. The corrected `abc9537...` product export has not yet been re-opened and solved in Rhino after the runtime-port correction, so full Phase 9 acceptance must not yet be claimed.

## Scope

Validate the zero-install GHX baseline in an actual Rhino 8 / Grasshopper host with no Brepia GHA installed.

Required acceptance sequence:

1. create a supported canonical Brepia model and verify native Brepia 3D preview;
2. export `.ghx` from the saved immutable Brepia revision;
3. open the generated GHX in Grasshopper without installing `Brepia.Grasshopper.gha`;
4. verify standard controls and the embedded Rhino 8 Python 3 Script component load correctly;
5. solve the definition and verify expected native Rhino Brep geometry and Brepia semantic outputs;
6. change at least two published parameters and verify geometry responds correctly;
7. save and reopen the GHX in Grasshopper;
8. return the Rhino-saved GHX to Brepia;
9. verify deterministic compatibility validation and recovery of the supported parameter values;
10. activate the imported immutable revision in Brepia and verify native Brepia preview;
11. continue editing the canonical model with Brepia AI;
12. export a fresh GHX and reopen/solve it successfully in Grasshopper.

Steps 1–3 are now proven for a fresh product export on the current path. Step 4 is proven through component load; the post-port-fix solve required for Step 5 is the next acceptance action.

## Acceptance boundaries

This phase tests the product loop already implemented in Phase 8. It is not an invitation to broaden the v1 round-trip contract.

Still unsupported unless separately implemented and validated:

- arbitrary native Grasshopper graph mutations that affect Brepia-owned semantics;
- rewiring Brepia-owned inputs through unknown logic;
- edited embedded Brepia script/runtime code;
- arbitrary plug-in components;
- generic Grasshopper graph to canonical `BrepProject` reconstruction.

If the returned file contains unsupported changes, Brepia should continue to fail closed rather than infer canonical state.

## Evidence classes

Repository CI evidence is necessary but not sufficient for this phase.

Required evidence must come from the installed Rhino/Grasshopper host and should record:

- Rhino and Grasshopper versions;
- exported GHX source Brepia revision;
- successful open/solve;
- native geometry/output verification;
- parameter edits performed;
- save/reopen result;
- Brepia re-import compatibility result;
- recovered parameter values;
- successful continuation/regeneration result.

## Relationship to Phase 8

Historical Phase 8 documentation may refer to the same runtime work as `8H`. Those references are superseded by this document: installed Rhino/Grasshopper acceptance is **Phase 9**, not a blocking Phase 8 sub-step.

Phase 8 can therefore be reviewed independently from the installed-host acceptance evidence. Phase 9 remains open until the full product loop above is completed.