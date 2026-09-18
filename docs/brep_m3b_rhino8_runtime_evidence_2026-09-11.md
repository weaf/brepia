# M3B — installed Rhino 8 / Grasshopper runtime evidence

Status: **accepted**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

This evidence closes the installed-host acceptance boundary for M3B bounded linear pattern.

Two fresh current-branch GHX fixtures were exercised in installed Rhino 8 / Grasshopper:

1. `linearPattern` as the canonical final `resultNodeId`, producing an ordered multi-Brep Result list;
2. `linearPattern` used as `subtract.tools[]`, producing a single Boolean result Brep.

## Accepted host behavior

The installed-host run confirmed:

- both generated GHX files opened successfully in Rhino 8 / Grasshopper;
- both definitions solved successfully;
- the final-pattern definition produced the expected repeated geometry through the list-aware Result path rather than requiring an implicit Boolean union;
- the pattern-as-subtract-tool definition produced the intended single resulting Brep through ordered cutter expansion;
- the generated files remained operational after **save -> close -> reopen**;
- the persisted Grasshopper definition retained the expected parameter wiring and solved again after reopen.

This acceptance is paired with the deterministic repository coverage in `tests/brepM3BRhinoPattern.test.ts`, which locks:

- final instance-set Result -> Grasshopper List Access;
- ordinary single result -> Item Access;
- ordered Rhino Brep duplication/translation for linear pattern;
- ordered expansion of pattern instances through Rhino BooleanDifference;
- fail-closed validation if a returned pattern GHX changes Result access from List to Item.

## Native parity already accepted

The same M3B contract had already passed the real local rootless build123d / OCCT runtime in:

```text
docs/brep_m3b_native_runtime_evidence_2026-09-11.md
```

That run verified:

- three ordered final pattern bodies with stable `pattern::0..2` identity;
- exact 20 mm X spacing;
- aggregate bounds `[-5,-5,-5] -> [45,5,5]`;
- exact multi-solid STEP availability;
- four pattern instances expanded as subtract cutters;
- final subtract result remaining exactly one `single` body.

## Conclusion

M3B bounded linear pattern now has all required acceptance layers:

- canonical/shared contract;
- provider/AI authoring contract;
- structural authoring UI;
- multi-body viewer;
- native build123d / OCCT execution;
- exact STEP/3DM export behavior;
- Rhino 8 / Grasshopper compilation;
- GHX Result Item/List persistence rules;
- repository CI;
- real native runtime;
- real installed Rhino 8 / Grasshopper runtime;
- save/close/reopen persistence.

M3B is therefore **complete**.

## Boundaries preserved

This closeout does not broaden:

- canonical `schemaVersion: 1`;
- M2 exact-one-body Boolean semantics;
- non-zero rotation support;
- arbitrary/nested collection algebra;
- GHX graph/source mutation on return;
- project-object geometry-role collection semantics;
- rectangular/grid pattern scope.

PR #36 remains draft, stacked and unmerged.
