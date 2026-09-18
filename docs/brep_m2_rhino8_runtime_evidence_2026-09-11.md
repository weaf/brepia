# M2 Rhino 8 / Grasshopper runtime evidence — 2026-09-11

Status: **installed Rhino 8 / Grasshopper runtime accepted, including save/close/reopen persistence**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Purpose

This record captures real installed Rhino 8 / Grasshopper evidence for M2 additive Boolean composition after repository CI and native build123d / OCCT runtime acceptance.

The permanent M2 contract requires `union` and `intersect` to produce exactly one final Brep for successful supported cases and to fail closed for unsupported zero- or multi-Brep result cardinality.

## Installed-host environment

The fixtures were exported from Brepia and opened in the user's installed Rhino 8 / Grasshopper environment using the active Rhino Python 3 GHX carrier.

Both generated GHX documents opened successfully and exposed the published `OffsetX` control to the generated Brepia Python component.

## Intersection evidence

A two-box canonical `intersect` fixture was opened in Grasshopper.

Observed supported state:

- the GHX opened and solved in the installed host;
- the `OffsetX` control was connected to the Brepia component;
- while the two boxes overlapped, Rhino displayed the common-volume result geometry;
- the generated Python path reached `Rhino.Geometry.Brep.CreateBooleanIntersection` successfully.

Observed unsupported state after moving the boxes apart:

```text
RuntimeError: Rhino boolean intersection for Brepia node overlap produced no Brep.
```

The Grasshopper component entered an error state and no successful empty result was presented.

This confirms the intended fail-closed empty-intersection contract in the real Rhino 8 host.

## Union evidence

A two-box canonical `union` fixture was opened in Grasshopper.

Observed supported state:

- the GHX opened and solved in the installed host;
- the `OffsetX` control was connected to the Brepia component;
- while the boxes overlapped, Rhino displayed the combined result geometry;
- the generated Python path reached `Rhino.Geometry.Brep.CreateBooleanUnion` successfully.

Observed unsupported state after moving the boxes apart:

```text
RuntimeError: Rhino boolean union for Brepia node union_AB did not produce exactly one Brep.
```

The Grasshopper component entered an error state rather than returning a disjoint multi-body result or selecting one body arbitrarily.

This confirms the intended exact-one-Brep union contract in the real Rhino 8 host.

## Save / close / reopen evidence

The generated GHX documents were also exercised across a persistence cycle in the installed host:

```text
working solved GHX
-> save
-> close
-> reopen in Grasshopper
-> published parameter wiring still present
-> supported state still solves
```

The user explicitly confirmed that the save/close/reopen sequence worked. No host-side source, port or parameter-wiring loss was observed after reopening.

## Accepted findings

The real installed-host evidence therefore proves:

1. current Brepia-generated GHX files for both M2 Boolean node types open in Rhino 8 / Grasshopper;
2. published parameters drive the generated Rhino Python component;
3. supported overlapping `intersect` solves to visible result geometry;
4. supported overlapping `union` solves to visible result geometry;
5. empty intersection fails closed with an explicit runtime error;
6. disjoint/multi-Brep union fails closed with an explicit exact-one-Brep runtime error;
7. the host behavior matches the native single-body/result-cardinality policy rather than degrading to compound or arbitrary-body semantics;
8. saved GHX documents can be closed and reopened while retaining the published parameter wiring and supported solve behavior.

No M2 compiler correction is indicated by this evidence.

## Acceptance conclusion

The installed Rhino 8 / Grasshopper acceptance boundary for M2 is complete.

Together with the repository CI and real native build123d / OCCT smoke evidence, M2 now has the required parity evidence to close formally and unblock M3 analysis.

## Preserved boundaries

This evidence does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` + immutable revision authority;
- build123d / OCCT native geometry authority;
- GHX parameter-only return/import boundary;
- non-zero rotation fail-closed behavior;
- schemaVersion `1`;
- M0/M1 scalar/integrity bounds;
- PR #36 draft/stacked/unmerged state.
