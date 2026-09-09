# Rhino 8 / Grasshopper upstream reference policy

This document defines the upstream implementation references to use for Brepia work that touches Rhino 8, RhinoCommon, Grasshopper, GH/GHX persistence, Rhino Python, `rhino3dm`, Rhino.Compute or related interoperability.

The purpose is to make the reference set explicit, reviewable and shared by all coding agents. Do not vendor the full McNeel sample repository into Brepia.

## Product target

Brepia's installed-host interoperability target is **Rhino 8 / Grasshopper running in the real target host**.

McNeel's official developer-samples repository is a primary implementation reference:

- repository: `https://github.com/mcneel/rhino-developer-samples`
- Rhino 8 branch: `https://github.com/mcneel/rhino-developer-samples/tree/8`
- reviewed Rhino 8 upstream checkpoint: `8462fc3487f8b7a58595ef73f6a5c09f92717f60`

McNeel documents that version-numbered branches correspond to the matching Rhino release. Therefore **use branch `8` for Rhino 8 compatibility work**. Do not use the repository default/development branch or branch `9` as evidence that behavior is available or identical in Rhino 8.

If the reviewed upstream checkpoint is intentionally advanced, record the new SHA and the reason for the update in the same change.

## Evidence hierarchy

For Rhino 8 / Grasshopper behavior, use the following order of authority:

1. **Installed Rhino 8 / Grasshopper host evidence** for actual open, solve, save, reopen and geometry behavior.
2. **Version-appropriate official McNeel SDK/API documentation**, when the documented version is known to cover Rhino 8.
3. **`mcneel/rhino-developer-samples` branch `8`**, pinned/reviewed as above.
4. **GH/GHX/3DM fixtures saved by the actual target Rhino 8 host**, used to verify persistence shape and round-trip behavior.
5. Community material such as Discourse, Stack Overflow, blog posts and third-party repositories.

Current online API pages may render documentation for a newer Rhino release. They are still useful for API names, concepts and signatures, but a page showing Rhino 9 must not by itself be treated as Rhino 8 compatibility proof. Cross-check version-sensitive behavior against branch `8`, a version-specific source, or the installed Rhino 8 host.

## High-value McNeel source areas

Prefer these folders when relevant:

- `grasshopper/` — Grasshopper document, component and GH_IO examples;
- `rhinocommon/` — RhinoCommon geometry and document operations;
- `rhinocommon/snippets/py/` — direct Python examples for the RhinoCommon API used by the current executable GHX carrier;
- `rhinocommon/snippets/cs/` — useful parity/reference implementations when Python examples are absent;
- `rhino3dm/` — openNURBS/rhino3dm interoperability;
- `compute/` — only when Rhino.Compute behavior is explicitly in scope;
- `rhino.inside/` — only when Rhino.Inside is explicitly in scope; it is not a baseline dependency of the zero-install GHX path.

Particularly relevant reviewed examples include:

- `grasshopper/cs/SampleGhFileAnalysis/Program.cs` — reads GH/GHX through `GH_Archive`, inspects `Definition`, `DocumentHeader`, `DefinitionProperties`, `DefinitionObjects` and `GHALibraries`, and reports archive messages;
- `rhinocommon/snippets/py/boolean-difference.py` — uses the document absolute tolerance and `Rhino.Geometry.Brep.CreateBooleanDifference(...)`;
- `rhinocommon/snippets/py/transform-breps.py` — applies a Brep translation with `Rhino.Geometry.Transform.Translation(...)`;
- `rhinocommon/cs/SampleCsCommands/SampleCsCurveDirection.cs` — maps a normalized curve position through `curve.Domain.ParameterAt(d)` before evaluating `curve.TangentAt(t)`, the same RhinoCommon parameterization pattern used by Brepia's semantic fillet edge selector;
- corresponding C# RhinoCommon samples when overload behavior or collection semantics need clarification.

For the current first multi-node host candidate (`box -> cylinder -> translate -> subtract`), the branch-8 review used the boolean-difference and transform-breps Python samples above. Those references confirm the RhinoCommon boolean and translation API patterns; primitive centering, canonical placement, graph ordering and topology/result semantics remain Brepia responsibilities and must be checked against the native build123d evaluator and the installed Rhino 8 host.

For canonical fillets, no direct branch-8 developer-sample implementing `Brep.CreateFilletEdges(...)` was found in the reviewed sample set. The version-specific official RhinoCommon 8 API is therefore the direct SDK authority for that call: `https://developer.rhino3d.com/api/rhinocommon/rhino.geometry.brep/createfilletedges?version=8.x`. Its seven-argument overload accepts edge indices, start/end radius collections, `BlendType`, `RailType` and tolerance and is available since Rhino 6, so it is within the Rhino 8 compatibility floor. Brepia uses `BlendType.Fillet`, `RailType.RollingBall` and the active document absolute tolerance.

## Grasshopper GH/GHX persistence rules

Official references:

- Grasshopper SDK / GH_IO reference: `https://mcneel.github.io/grasshopper-api-docs/api/grasshopper/html/723c01da-9986-4db2-8f53-6f3a7494df75.htm`
- `GH_DocumentIO` methods: `https://developer.rhino3d.com/api/grasshopper/html/Methods_T_Grasshopper_Kernel_GH_DocumentIO.htm`
- McNeel Rhino 8 sample: `grasshopper/cs/SampleGhFileAnalysis/Program.cs` on branch `8`.

Operational rules:

- Treat `GH_IO` / `GH_Archive` / `GH_DocumentIO` behavior and Rhino-saved fixtures as the persistence authority rather than inventing an independent GHX dialect.
- Hand-authored GHX must not be considered valid merely because it is well-formed XML or passes Brepia's parser. It must match the structures expected by Grasshopper and ultimately open in the installed Rhino 8 host.
- When changing the executable GHX envelope, inspect standard document structures such as `DocumentHeader`, `DefinitionProperties`, `DefinitionObjects`, `GHALibraries`, archive/root metadata and thumbnail/icon behavior where relevant.
- Preserve strict Brepia round-trip validation. Host-compatible persistence does not make arbitrary returned graph/script/wiring mutations acceptable.
- Repository CI is necessary but does not substitute for installed-host acceptance.

## RhinoCommon geometry translation rules

Before adding or changing a canonical BRep DAG node translation to RhinoCommon:

1. inspect the corresponding branch-8 McNeel sample when one exists;
2. compare API tolerance, collection and failure semantics against Brepia's canonical/native kernel behavior;
3. preserve Brepia's canonical coordinate, placement and topology semantics rather than merely producing visually similar geometry;
4. add deterministic repository regression coverage;
5. keep unsupported or unproven operations fail-closed;
6. obtain installed Rhino 8 host evidence before claiming runtime parity for a newly supported operation.

For boolean operations, follow RhinoCommon's tolerance-aware pattern. The McNeel Rhino 8 Python boolean-difference sample uses the active document's `ModelAbsoluteTolerance` with `Brep.CreateBooleanDifference(...)`.

For translation, the reviewed Rhino 8 `transform-breps.py` sample uses `Rhino.Geometry.Transform.Translation(...)`. Brepia applies that transformation to duplicated local Breps so the canonical source DAG remains immutable while derived nodes receive their canonical translation.

For fillets, Brepia preserves the native build123d selector contract instead of exposing raw Rhino edge numbers as canonical state. `all` selects every edge. `parallelToAxis` evaluates each Rhino Brep edge tangent at the normalized midpoint (`Domain.ParameterAt(0.5)` then `TangentAt(...)`), unitizes it and applies the native selector threshold `abs(abs(dot(axis)) - 1.0) <= 1e-3`. The selected topology indices and one constant radius per edge are passed as explicit .NET arrays to `Brep.CreateFilletEdges(...)`. Empty selection, non-positive radius or a result other than exactly one Brep fails closed. This is repository translation support only until the exact fillet graph is accepted in the installed Rhino 8 host.

Primitive origin/alignment semantics must be checked against Brepia's authoritative native BRep evaluator rather than assumed from Rhino defaults.

## Python 3 executable GHX carrier

The current product architecture uses Rhino 8's built-in **Python 3 Script** component as the zero-install executable GHX carrier. The current architecture/status documents remain authoritative for that product decision.

When working on this carrier:

- keep serialized input/output port identifiers and runtime Python identifiers generated from the same deterministic plan;
- treat identifiers as case-sensitive;
- use RhinoCommon directly rather than adding a Brepia GHA dependency to the baseline flow;
- preserve canonical Brepia placement internally unless a separately designed placement-edit contract explicitly makes placement user-editable in Grasshopper;
- do not broaden the accepted return boundary merely because Python can express additional graph behavior.

## Licensing

`mcneel/rhino-developer-samples` carries a permissive McNeel sample-code license. Small adapted samples may be used when appropriate, but retain required attribution/license notices and prefer implementing against the documented API rather than copying large bodies of sample code.

## Maintenance checklist

When Rhino/Grasshopper interoperability work changes materially:

- confirm the product target Rhino version;
- confirm the McNeel samples branch matches that version;
- record an updated reviewed upstream SHA if deliberately advancing it;
- note any host finding that invalidates a repository-only assumption in `docs/brep_phase9_rhino_acceptance.md` or its successor;
- keep this reference policy concise and source-oriented rather than duplicating implementation status from architecture/acceptance documents.