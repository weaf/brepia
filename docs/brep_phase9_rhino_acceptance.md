# BRep Phase 9 — installed Rhino/Grasshopper acceptance

## Status

**Active; partial installed-host evidence exists. Full product-loop acceptance is not yet complete.**

Phase 9 remains intentionally separated from repository-only Phase 8 evidence. Repository CI is necessary, but only a real installed Rhino 8 / Grasshopper host can prove that a Brepia-exported GHX opens, solves, saves and reopens correctly.

On 2026-09-09 the first installed-host session exposed two assumptions that repository validation had not proven:

1. the hand-written executable GHX used an incomplete Grasshopper document envelope and failed during Grasshopper IO with `Object reference not set to an instance of an object`;
2. the original embedded C# Script path was not the simplest proven zero-install execution carrier for the target Rhino 8 host.

The host diagnosis then established a working direction:

- a document using the envelope shape from a real Grasshopper-saved GHX opened successfully;
- the same envelope with Brepia numeric controls also opened successfully;
- a modern built-in Rhino 8 **Python 3 Script** component loaded without a Brepia GHA;
- the first Python probe reached script execution but exposed a case-sensitive port/source-name mismatch (`width`/`height` versus `Width`/`Height`);
- after making the Python source identifiers exactly match the serialized script-port identifiers, the box solved and became visible;
- the corrected Python diagnostic loaded quickly in the installed host.

This is strong host evidence for the **document-envelope + Rhino 8 Python 3 Script** direction. It is not yet evidence that the product exporter on the current branch has completed the full acceptance sequence below.

## Current implementation correction

The active GHX implementation on `feature/brep-grasshopper-gh-packaging` is being corrected to preserve the existing canonical/round-trip architecture while changing only the host-facing persistence/runtime carrier:

- canonical `BrepProject` and immutable revision authority remain unchanged;
- generated native Number/Slider controls and stable parameter/control identities remain unchanged;
- the executable bridge uses the built-in Rhino 8 Python 3 Script component (`719467e6-7cf5-4848-99b0-c5dd57e5442c`) through `RhinoCodePluginGH`;
- Python source and serialized `InputParam`/`OutputParam` names are generated from the same script plan so case-sensitive identifiers cannot drift;
- the product executable GHX receives the fuller Grasshopper document envelope required by installed-host evidence, including standard document metadata, `GHALibraries` and a Thumbnail archive chunk;
- strict returned-GHX validation still freezes Brepia-owned graph, wiring, script source/runtime state and published parameter identity while allowing only the already-supported bounded parameter edits.

The internal parameter-shell codec remains an implementation/parser foundation; installed-host compatibility is required of the **product executable GHX**.

## Scope

Validate the zero-install GHX baseline in an actual Rhino 8 / Grasshopper host with no Brepia GHA installed.

Required acceptance sequence:

1. create a supported canonical Brepia model and verify native Brepia 3D preview;
2. export `.ghx` from the saved immutable Brepia revision using the current product exporter;
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

The diagnostic Python GHX accepted on 2026-09-09 proves the runtime carrier can work, but it does **not** substitute for steps 2–12 using the actual current Brepia exporter and import lifecycle.

## Acceptance boundaries

This phase tests the product loop already implemented around the strict canonical boundary. It is not an invitation to broaden the v1 round-trip contract.

Still unsupported unless separately implemented and validated:

- arbitrary native Grasshopper graph mutations that affect Brepia-owned semantics;
- rewiring Brepia-owned inputs through unknown logic;
- edited embedded Brepia script/runtime code;
- arbitrary plug-in components;
- generic Grasshopper graph to canonical `BrepProject` reconstruction.

If the returned file contains unsupported changes, Brepia should continue to fail closed rather than infer canonical state.

## Evidence classes

Repository CI evidence is necessary but not sufficient for this phase.

Required final evidence must come from the installed Rhino/Grasshopper host and should record:

- Rhino and Grasshopper versions;
- exported GHX source Brepia revision;
- successful open/solve;
- native geometry/output verification;
- parameter edits performed;
- save/reopen result;
- Brepia re-import compatibility result;
- recovered parameter values;
- successful continuation/regeneration result.

Negative host findings are also evidence and should remain recorded when they explain an implementation correction, as with the original incomplete document envelope and the superseded C# executable candidate.

## Relationship to Phase 8

Historical Phase 8 documentation may refer to the installed-runtime work as `8H` or describe the pre-host C# executable candidate. Those references are implementation history, not current installed-host proof.

The Brepia-side Phase 8H round-trip remains separately accepted. Installed Rhino/Grasshopper open/solve/edit/save/reopen acceptance is **Phase 9** and must not be inferred from repository CI or from the earlier browser-only round-trip.
