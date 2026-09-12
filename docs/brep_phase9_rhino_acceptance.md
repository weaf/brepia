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
6. The production GHX compiler was updated to the fuller host-compatible envelope plus the built-in Python 3 carrier.
7. The first fresh product export exposed a runtime identifier mismatch between serialized ports and embedded Python source. The production script plan was corrected so both are generated from the same deterministic names.
8. A **fresh Brepia product export after that correction has now been opened and solved successfully in the installed Rhino 8 / Grasshopper host**. The native box geometry is visible and solves quickly.
9. `Height` and `Width` are working Grasshopper inputs and drive the product geometry as intended.
10. The former editable `Plane` product input has been removed. Canonical Brepia placement remains internal and is applied by the generated Python carrier, preserving the product's placement authority rather than exposing it as a casual Grasshopper parameter.
11. Two additional, more complex Brepia-generated GHX models have now also been opened successfully in the installed Rhino 8 / Grasshopper host. This demonstrates that the zero-install Python 3 carrier and host-compatible GHX envelope are not limited to the original single-box diagnostic.

The broader two-model host result is deliberately recorded as **definition-level interoperability evidence**, not as an unqualified parity claim for every canonical operation. Exact operation-level acceptance remains tied to the concrete canonical node graph exercised by a host test; operations whose presence in those two models has not been recorded must not inherit acceptance by implication.

This advances the zero-install product path beyond the earlier single-box checkpoint. It does **not** complete Phase 9 as a whole: save/reopen, returned-GHX import/activation/continuation and the broader canonical BRep operation surface remain separately evidenced acceptance work.

The next explicit geometry-runtime acceptance target remains the repository-supported canonical graph:

```text
box -> cylinder -> translate -> subtract
```

That through-hole path is covered by deterministic repository generation tests. If one of the newly accepted complex definitions is confirmed to contain this exact canonical graph, record that graph-level evidence explicitly before describing it as installed-host parity; otherwise keep the graph-specific acceptance open.

The current RhinoCommon implementation review for this graph is pinned through `docs/references/rhino8_mcneel_sources.md`. The reviewed McNeel Rhino 8 branch-8 Python examples cover tolerance-aware `Brep.CreateBooleanDifference(...)` and `Transform.Translation(...)`; Brepia still owns and tests primitive centering, canonical placement, graph ordering, result cardinality and fail-closed semantics.

## Current repository scope for complex geometry

The executable Python/GHX compiler currently has repository support for:

- centered canonical `box` primitives;
- centered canonical `cylinder` primitives;
- canonical translation-only `transform` nodes, including parameter-backed translation scalars;
- canonical `subtract` nodes;
- multiple subtract tools applied deterministically in canonical `tools[]` order, with each boolean step required to produce exactly one Brep;
- canonical `fillet` nodes using the currently accepted semantic `parallelToAxis` selector;
- parameter-backed fillet radii;
- exact project-object role-node reuse where the referenced node is supported.

The fillet translation mirrors the authoritative native evaluator's accepted selector semantics rather than exposing Rhino edge indices as Brepia state. `parallelToAxis` samples the normalized edge midpoint tangent and applies the same `1e-3` axis-parallel threshold. Rhino execution uses `Brep.CreateFilletEdges(...)` with `BlendType.Fillet`, `RailType.RollingBall` and document absolute tolerance. Non-positive radius, empty selector result or a Rhino result other than exactly one Brep fails closed. Canonical v1 normalization does not currently admit an `all` selector, and the GHX exporter does not broaden that boundary independently. The Rhino 8 upstream/API review is recorded in `docs/references/rhino8_mcneel_sources.md`.

**Fillet support is repository-level only at this checkpoint unless a recorded installed-host test is confirmed to include a canonical fillet node.** Do not infer fillet host parity from a complex-model success without recording that the exercised graph actually contained the fillet operation and produced the expected topology.

Still intentionally fail-closed on the active Rhino/GHX path:

- non-zero transform rotation;
- canonical node types that have not been explicitly mapped and tested in the Rhino compiler.

Repository support is not installed-host acceptance. The sequence remains: compare against the authoritative native build123d evaluator, inspect the Rhino 8 upstream reference, add deterministic tests, then obtain real Rhino 8 host evidence before claiming parity.

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

For the current simple-box product path, steps 1–5 are proven with a fresh product export, and the working Height/Width controls provide parameter-response evidence toward step 6. Two additional nontrivial product definitions have also opened successfully, broadening the definition-level host evidence. The remaining sequence must still be completed before full Phase 9 acceptance is claimed.

For each newly broadened canonical geometry operation, opening and solving another model is only transferable runtime evidence when the exact exercised graph is recorded. The broadened graph must separately pass installed-host acceptance before operation-level parity is claimed.

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