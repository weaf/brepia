# BRep Phase 9 — installed Rhino/Grasshopper acceptance

## Status

Deferred until a real Rhino 8 / Grasshopper workstation is available.

Phase 9 is intentionally separated from Phase 8 so repository development is not blocked by access to a licensed installed Rhino runtime.

Phase 8 is repository-complete through the strict GHX export/import boundary. Phase 9 supplies the real-runtime interoperability evidence that CI cannot provide.

## Scope

Validate the zero-install GHX baseline in an actual Rhino 8 / Grasshopper host with no Brepia GHA installed.

Required acceptance sequence:

1. create a supported canonical Brepia model and verify native Brepia 3D preview;
2. export `.ghx` from the saved immutable Brepia revision;
3. open the generated GHX in Grasshopper without installing `Brepia.Grasshopper.gha`;
4. verify standard controls and the embedded Rhino 8 C# Script component load correctly;
5. solve the definition and verify expected native Rhino Brep geometry and Brepia semantic outputs;
6. change at least two published parameters and verify geometry responds correctly;
7. save and reopen the GHX in Grasshopper;
8. return the Rhino-saved GHX to Brepia;
9. verify deterministic compatibility validation and recovery of the supported parameter values;
10. activate the imported immutable revision in Brepia and verify native Brepia preview;
11. continue editing the canonical model with Brepia AI;
12. export a fresh GHX and reopen/solve it successfully in Grasshopper.

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

Phase 8 can therefore be completed, reviewed and integrated independently of workstation availability. Phase 9 should begin only when the required Rhino 8 environment is available.
