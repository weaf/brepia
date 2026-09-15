# BRep modeling handover after M3

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Closeout checkpoint immediately before this handover document:

```text
a4245ce41da088170a0a42c8d9d6a20d0ef6243d
Close M3 repetition and symmetry track
```

## Current accepted state

M0 through M3B are complete.

### M0

Parameter effectiveness, reachability/orphan analysis and authoritative-result integrity are complete.

### M1

Bounded scalar expression AST is complete.

Permanent limits remain:

```text
canonical expression depth: 12
canonical expression nodes: 64
provider expression depth: 2
```

Provider-facing schema remains finite/reference-free.

### M2

`union` and `intersect` are complete across repository/CI, native build123d/OCCT and installed Rhino 8 / Grasshopper.

Boolean result cardinality remains fail-closed and exact-one-body. Disjoint union, empty intersection and unsupported multi-body Boolean results are not silently converted to compounds or arbitrary selected bodies.

### M3A

Canonical `mirror` is complete across repository/CI, native and installed Rhino 8 / Grasshopper.

The canonical Y-normal parity fix is important:

```text
x -> build123d Plane.YZ
y -> build123d Plane.ZX
z -> build123d Plane.XY
```

`Plane.ZX` is intentional so positive canonical Y-offset remains `Y = +offset`.

### M3B

Bounded `linearPattern` and the explicit `single | instanceSet` result model are complete across repository/CI, native and installed Rhino 8 / Grasshopper.

Canonical shape:

```ts
{
  id: string;
  type: 'linearPattern';
  input: string;
  axis: 'x' | 'y' | 'z';
  count: number;      // literal integer 2..32
  spacing: BrepScalar;
}
```

Key semantics:

- input is single-only;
- resolved spacing is finite and non-zero;
- instance 0 is unshifted;
- instance i is `i * spacing` along the selected axis;
- final pattern is an ordered `instanceSet`, not an implicit Boolean union;
- evaluated body IDs are `<patternId>::<index>`;
- `subtract.tools[]` may consume an instance set and expands ordered cutters;
- transform, mirror, fillet, another pattern, union/intersection, subtract base and project-object geometry roles remain single-only;
- nested/general collection algebra remains unsupported/fail-closed.

Viewer renders all result bodies while preserving semantic identity.

Exact STEP may use a build123d Compound only as an export container. It is not canonical/result identity.

Rhino/GHX emits final pattern output as an ordered list of separate Breps. Grasshopper `Result` persists as:

```text
single       -> Item Access
instanceSet  -> List Access
```

Returned GHX remains parameter-only.

## M3B acceptance evidence

Repository candidate:

```text
94e1b0fca3b1d01b016faeee52bb9cdeb564f4b4
Quality Gate #937       PASS
Grasshopper Build #509  PASS
```

Later runtime-preparation/docs checkpoint:

```text
a6f030f5752a3c1eb2fb53d9d188d132ec8ff302
Quality Gate #939       PASS
Grasshopper Build #511  PASS
```

Native runtime accepted on 2026-09-11:

- M2 and M3A regression corpus remained green;
- final pattern produced `resultKind: instanceSet`;
- bodies `pattern::0`, `pattern::1`, `pattern::2`;
- exact 20 mm X spacing;
- aggregate bounds `[-5,-5,-5] -> [45,5,5]`;
- exact STEP available;
- four-instance pattern-as-subtract-tool produced one `single` result with exact STEP available.

Installed Rhino 8 / Grasshopper accepted both fresh M3B GHX fixtures on 2026-09-11:

1. final list-result linear pattern;
2. pattern used as subtract cutters.

Both files opened and solved, and both survived save -> close -> reopen while remaining functional.

Evidence files:

- `docs/brep_m3b_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_linear_pattern_status.md`;
- `docs/brep_m3_repetition_symmetry_plan.md`.

## Product/UX work already accepted on this branch

Also preserve the BRep product changes completed during this track:

- bounded BRep parameters have synchronized range sliders plus exact numeric input;
- historical BRep AI iterations can be loaded into the workspace without moving the authoritative chat branch;
- historical iteration preview is read-only;
- GHX import is disabled while viewing historical revisions;
- `/brep` is now the saved BRep Models library rather than the old Phase-1 sample creation surface;
- Native BRep creation remains through normal New Creation flow;
- `docs/brep_saved_model_clone_plan.md` records deferred `Use as starting point` / clone semantics.

Do not implement saved-model clone/duplicate until the modeling capability track is deliberately considered complete or the user explicitly reprioritizes it.

## Permanent architecture locks

Preserve unless explicitly re-planned:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` + immutable revisions are authority;
- build123d/OCCT is native geometry authority;
- Rhino/GHX is an interoperability compiler, not canonical authority;
- canonical `schemaVersion = 1`;
- M0/M1/M2 semantics remain intact;
- canonical scalar depth 12;
- scalar node limit 64;
- provider expression depth 2;
- finite/reference-free provider schema;
- Settings/discovery is model authority;
- GHX return/import remains parameter-only;
- non-zero rotation remains fail-closed until M6 parity work;
- OpenSCAD regressions must stay green;
- C4 remains deferred until real image-bearing conversation evidence exists;
- PR #36 must remain draft, stacked and unmerged unless explicitly instructed otherwise.

## Next scope decision

Do not automatically expand M3 merely because `instanceSet` now exists.

Start the next chat with analysis and reconciliation against actual current implementation, then decide explicitly between:

### Option A — M3C rectangular/grid pattern

Potential value:

- repeated bolt-hole grids;
- arrays of panels/cabinets;
- 2D repetition before profile work.

Would need a deliberately bounded contract built on the accepted instance-set semantics. Do not introduce nested/general collection algebra accidentally.

### Option B — M4 profile + extrusion foundation

Current roadmap candidate surface:

- rectangle profile;
- circle profile;
- bounded closed polyline profile;
- extrusion along a canonical axis/direction.

This is likely the higher-value default because it unlocks ordinary plates, walls, outlines and sketch-like mechanical/architectural forms that currently require awkward 3D Boolean construction.

**Recommended starting assumption:** prefer M4 unless reconciliation finds a concrete near-term use case that makes rectangular/grid pattern more valuable first.

## First actions in the next chat

1. Read `AGENTS.md`.
2. Read this handover.
3. Read and reconcile:
   - `docs/brep_modeling_capability_expansion_plan.md`;
   - `docs/brep_m3_repetition_symmetry_plan.md`;
   - `docs/brep_m3b_linear_pattern_status.md`;
   - M3B native/Rhino evidence;
   - `docs/brep_phase9_modeling_handover.md`;
   - `docs/references/rhino8_mcneel_sources.md`.
4. Reconcile those documents against actual branch implementation before changes.
5. Correct any stale high-level roadmap wording that still describes M3B runtime acceptance as pending.
6. Analyze M3C-vs-M4 product/architecture value before implementation.
7. Keep PR #36 draft/stacked/unmerged.

Do not start a new modeling feature before that reconciliation and scope decision is recorded.
