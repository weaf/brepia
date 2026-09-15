# BRep Phase 9 — exact installed-host model evidence (2026-09-09)

Status: real installed Rhino 8 / Grasshopper evidence supplied from two fresh Brepia BRep project exports that the operator opened successfully in Grasshopper.

This note narrows the broader Phase 9 host evidence to the exact canonical graphs present in those tested projects. It does not broaden the GHX round-trip contract and it does not infer visual/topological parity for operations that were not authoritative outputs.

## Evidence source A — room with doorway and four-cabinet massing

Canonical project: `room_door_cabinets` / `Room with door and cabinet bank`.

The authoritative result graph is a translated centered box followed by one subtract with eight ordered tools. The graph contains only:

- `box` primitives;
- translation-only `transform` nodes;
- one `subtract` result node with eight cutters.

The project therefore gives installed-host open/solve evidence for:

- centered box generation;
- literal translation;
- a non-trivial multi-node dependency graph;
- sequential multiple-cutter subtraction with eight tools;
- parameter-backed box dimensions on nodes that participate in the authoritative result.

It does not exercise cylinders, non-zero rotation or fillets.

### Parameter audit

Published parameters: 10.

Directly referenced somewhere in the authoritative result dependency graph:

- `cabinet_depth`;
- `door_width`;
- `room_height_z`;
- `room_length_x`;
- `room_width_y`.

Published but not referenced by any node:

- `cabinet_gap`;
- `cabinet_height`;
- `cabinet_width`;
- `door_height`;
- `wall_thickness`.

This means half of the exposed parameters cannot affect native geometry at all.

Several intended relationships are also baked into literals instead of remaining parametric. Examples include the room-base Z translation `1500`, fixed `200`/`300`-class wall/cutter dimensions, fixed gap widths and cabinet/opening positions. Consequently even some referenced room-size parameters are only partially parametric: changing an outer room dimension does not automatically recompute every dependent void, wall thickness, opening or cabinet placement.

The cabinets are represented indirectly by subtracting voids from one room solid rather than as four explicit repeated cabinet solids. This explains the observed Boolean-heavy topology and why cabinet width/height/gap controls were disconnected from the result.

## Evidence source B — rectangular mounting plate

Canonical project: `rectangular-plate` / `Mounting plate`.

The graph contains:

- one parameter-backed `box` plate;
- two `cylinder` primitives;
- two translation-only transforms, including parameter-backed X/Y translation;
- one `subtract` with two cutters;
- one `fillet` node using the `parallelToAxis` selector.

The authoritative `resultNodeId` is `plate_with_hole`, not the downstream `fillet` node.

The project therefore gives installed-host open/solve evidence for:

- centered box generation;
- centered cylinder generation;
- literal and parameter-backed translation;
- two-cutter subtraction;
- a complex definition containing a canonical fillet node without causing a host solve failure.

The fillet node is not the authoritative result. Because the current GHX compiler emits canonical nodes before assigning outputs, successful solve is useful execution-level evidence for the Rhino fillet translation, but this project is not sufficient visual/topological parity evidence for a filleted authoritative Result. A dedicated fresh export whose `resultNodeId` is the fillet remains required before claiming full installed-host fillet acceptance.

The `rotateDeg` field on `hole_transform` is `[0, 0, 0]`; it does not exercise rotation and must not be counted as rotation host evidence.

### Parameter audit

Published parameters: 10.

Parameters that affect the authoritative result graph:

- `hole_radius`;
- `hole_x`;
- `hole_y`;
- `plate_depth`;
- `plate_thickness`;
- `plate_width`.

Published parameters that do not affect the authoritative result:

- `fillet_radius` — referenced only by the orphan/non-result fillet branch;
- `hole_diameter` — no node reference;
- `parameter` — no node reference;
- `parameter2` — no node reference.

The second cutter is also mostly literal (`radius = 10`, `height = 501`, translation X = `50`), so it is not controlled by the published hole parameters.

## Installed-host operation matrix after these two models

| Canonical operation/behavior | Installed Rhino 8 evidence | Boundary |
| --- | --- | --- |
| box | accepted | visible authoritative geometry in both projects |
| cylinder | accepted | plate project opens/solves with two cylinders |
| translation-only transform | accepted | both literal and parameter-backed translation present |
| parameter-backed translation scalar | accepted at definition/solve level | `hole_x` / `hole_y` are wired into authoritative cutter transform |
| subtract | accepted | authoritative result in both projects |
| multiple subtract tools | accepted | 8-tool room subtraction and 2-tool plate subtraction |
| fillet | execution-level evidence only | fillet node solves but is not `resultNodeId`; dedicated visual Result acceptance still required |
| non-zero rotation | not accepted | only `[0,0,0]` rotation field observed |
| union / intersection | not in canonical schema v1 | no claim |
| save/reopen in Grasshopper | still separately required unless operator records it | opening a fresh export is not save/reopen evidence |
| returned GHX import / activation / AI continuation | still required | Phase 9 product-loop work remains open |

## Product-quality finding

The host translation is now capable of solving substantially more complex definitions than the first single-box baseline. The larger product limitation exposed by these files is upstream of Rhino: the current canonical modeling language and AI-output validation allow published parameters that do not reach authoritative geometry and encourage large assemblies to be approximated through boxes plus subtractive voids with baked numeric relationships.

This evidence therefore supports two separate work streams:

1. finish the remaining Phase 9 installed-host round-trip acceptance without broadening its contract;
2. improve canonical BRep modeling expressiveness and parameter integrity as a distinct post-Phase-9/modeling-capability track.
