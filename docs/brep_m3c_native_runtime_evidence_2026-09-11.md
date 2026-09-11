# M3C native build123d / OCCT runtime evidence — 2026-09-11

Status: **accepted**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Runtime-accepted implementation checkpoint:

```text
c46a12c2d488a083e17c43ca97608b37a717767f
Complete M3C rectangular pattern repository integration
```

The implementation tree at that checkpoint had already passed repository CI separately:

```text
Quality Gate #1027       PASS
Grasshopper Build #599  PASS
```

Repository CI is not treated as native runtime evidence; the acceptance below was performed separately against the real pinned local BRep runtime.

## Runtime stack

The runtime reported:

```text
build123d=0.11.1
cadquery-ocp-novtk=7.9.3.1.1
OCP=7.9.3.1
rhino3dm=8.32.1
```

This matches the pinned build123d / OCCT authority selected for the native BRep path.

## Runtime command

The M3C smoke was run through the repository script:

```bash
scripts/brep/m3c-rectangular-pattern-smoke.sh
```

The script uses `set -euo pipefail`; completion therefore means all explicit shape/order/export assertions in both fixtures passed.

## Observed output

```text
{"result":"pattern","resultKind":"instanceSet","ids":["pattern::0","pattern::1","pattern::2","pattern::3","pattern::4","pattern::5"],"offsets":[[0,0],[0,30],[0,60],[20,0],[20,30],[20,60]],"exactStep":true}
{"result":"cut","resultKind":"single","orderedTools":["singleToolAt","cutters"],"exactStep":true}
```

## Final rectangular-pattern acceptance

The final-result fixture proves the canonical 2 x 3 row-major contract in the real build123d / OCCT evaluator:

- `resultNodeId = pattern`;
- `resultKind = instanceSet`;
- exactly six independent result bodies;
- stable identities `pattern::0` through `pattern::5`;
- row-major ordering with axis A outer and axis B inner;
- flat index `a * countB + b`;
- offsets in canonical order:

```text
0 -> [0, 0]
1 -> [0, 30]
2 -> [0, 60]
3 -> [20, 0]
4 -> [20, 30]
5 -> [20, 60]
```

The smoke script also asserts for every body:

- matching `nodeId = pattern`;
- matching stable `instance.index`;
- `instance.sourceNodeId = body`;
- non-empty viewer mesh indices;
- offsets derived from actual body bounds rather than only from planned values.

The fixture uses a published `pitchA` parameter and an M1 expression for B spacing (`pitchBaseB + 5`), so the accepted geometry exercises both direct parameter and derived scalar paths.

Exact STEP export was available and the emitted STEP file contained the expected ISO-10303-21 header. The same fixture also emitted a readable 3DM artifact.

## Rectangular pattern as ordered subtract tools

The second fixture proves the intended M3B/M3C collection-consumption boundary:

```text
subtract.tools = [singleToolAt, cutters]
```

where `cutters` is a bounded rectangular `instanceSet`.

The accepted runtime result confirms:

- the explicit single tool is consumed first;
- the rectangular pattern is consumed as the second ordered tool entry;
- its instances are expanded through the native ordered cutter path;
- final `resultNodeId = cut`;
- final `resultKind = single`;
- exactly one final body is emitted;
- the final body has a non-empty viewer mesh;
- exact STEP export remains available.

This preserves the policy that an `instanceSet` may be consumed only through `subtract.tools[]`; it does not broaden `subtract.base`, Boolean union/intersection, transforms, fillets or project-object roles to general collections.

## Preserved authority and semantics

This runtime acceptance does not change:

- canonical `schemaVersion: 1`;
- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep plus immutable revision authority;
- build123d / OCCT as geometry authority;
- Rhino/GHX as interoperability compiler only;
- M0 parameter-effectiveness policy;
- M1 canonical scalar depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean policy;
- M3B `single | instanceSet` result kinds;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ rotation semantics `R = Rx * Ry * Rz`, `p' = R*p + T`;
- GHX parameter-only return/import boundary;
- OpenSCAD behavior;
- C4, M5 and M7 deferrals.

## Conclusion

M3C native build123d / OCCT runtime acceptance is **complete**.

Installed Rhino 8 / Grasshopper acceptance was subsequently completed as a separate external evidence layer and is recorded in:

```text
docs/brep_m3c_rhino8_runtime_evidence_2026-09-11.md
```

That host run separately proved final rectangular pattern Result List behavior, parameter-driven spacing recomputation, save -> close -> reopen persistence, rectangular pattern as subtract cutters with final Result Item behavior, and strict parameter-only returned-GHX validation.

The native and installed-host evidence remain deliberately separate from repository CI evidence.

PR #36 remains open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
