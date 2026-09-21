# Bounded planar elbow sweep — authenticated product-path evidence

Status: **accepted**

Date: 2026-09-21

Repository: `weaf/brepia`

Branch: `feature/brep-planar-elbow-sweep`

## Scope

This evidence closes Gate D for the bounded planar 90-degree circular sweep by rerunning the original product-gap Target E through the normal authenticated Native BRep product path.

The implementation/runtime checkpoint used for the product flow was:

```text
533eb64ba51700bdb2a227164b9499988e3fd2fa
Add sweep Rhino Gate C acceptance tooling
```

Later branch commits before this evidence were documentation/tooling-only and did not change the running sweep implementation.

## Execution path

The existing product-gap acceptance harness was used unchanged:

```text
npm run test:brep-gap-audit
```

Target:

```text
E — Bent path-based object
```

The run used the real authenticated Brepia UI and normal Native BRep generation route against the stable local runtime.

Execution was launched as a finite Dquark-Control Herdr job:

```text
request_id=brepia-sweep-gated-product-path-20260921-02
operation=herdr-job-run
required_local_ports=3000,54321,9292
run_status=completed
run_rc=0
```

GitHub Actions evidence:

```text
Dquark Control run 35633838120
conclusion=success
```

Playwright result:

```text
BRep product-gap audit target E: Bent path-based object
1 passed (2.3m)
```

## Actual model and transport

The generated manifest records:

```text
model: local/qwen3.6-35b-heretic-mtp-128k
openCodeExecutionMode: cli
generationOutcome: ready
```

Conversation:

```text
81b9dbbf-66c5-4a7d-9ab3-23e821dfc998
```

## Canonical product result

The normal product export produced:

```text
e-canonical.brepia-brep.json
```

The canonical project is:

```text
projectId: product-gap-e-bent-handrail
projectName: Product Gap E Bent Handrail
resultNodeId: handrail-sweep
nodeCount: 1
resultKind: single
```

Node histogram:

```json
{
  "sweep": 1
}
```

There are no box or cylinder nodes and no primitive approximation of the requested smooth bend.

The exported canonical node is semantically the locked first sweep slice:

```text
type                 = sweep
profile.type         = circle
profile.radius       = tubeDiameter / 2
path.type            = planarElbow90
planeNormalAxis      = z
firstLegLength       = 1000 mm
secondLegLength      = 700 mm
bendRadius           = bendRadius parameter
```

Published controls are exactly:

```text
Bend Radius    default 150 mm
Tube Diameter  default 40 mm
```

## Integrity evidence

The manifest reports:

```text
orphanNodeIds          = []
orphanOnlyParameterIds = []
unusedParameterIds     = []
```

Both published parameters classify as effective:

```text
bendRadius
tubeDiameter
```

The authoritative graph contains only the result-reachable sweep node.

## Native evaluation

Nominal evaluation returned:

```text
HTTP 200
status: success
resultKind: single
warnings: []
bounds:
  min = [0, -20.0000001, -20.0000001]
  max = [1170.0000001, 850, 20.0000001]
```

This matches the locked Z-plane nominal fixture with 20 mm profile radius, 150 mm centerline bend radius and 1000/700 mm straight legs.

## Product-UI perturbation and immutable revision

The normal product parameter editor changed:

```text
Bend Radius: 150 -> 180 mm
```

The resulting native evaluation remained successful:

```text
HTTP 200
status: success
resultKind: single
warnings: []
bounds:
  min = [0, -20.0000001, -20.0000001]
  max = [1200.0000001, 880, 20.0000001]
```

The manifest records:

```text
inputValue    = 180
savedRevision = true
```

The harness also captured the perturbed product screenshot and bounded integrity manifest under the local Gate-D evidence directory.

## Comparison with the original Target E failure

The pre-sweep audit produced a structurally valid but semantically incorrect graph:

```text
2 box
1 cylinder
2 union
```

That graph had no true path/sweep representation and used the Bend Radius parameter as primitive-cylinder radius.

The post-sweep authenticated product run instead produces exactly one canonical `sweep` node with the required constant circular section and true tangent planar elbow path.

The representational gap that selected this implementation slice is therefore closed through the same user-facing product family that originally exposed it.

## Preserved boundary

This evidence does not broaden the feature beyond the locked contract.

It proves only the accepted bounded slice:

- one circle profile;
- one planar 90-degree elbow;
- fixed line + tangent quarter-circle + line path;
- positive dimensions and `profile.radius < bendRadius`;
- existing scalar/expression semantics;
- one authoritative solid result.

No arbitrary path grammar, multi-bend path, arbitrary bend angle, non-planar rail, non-circular profile, twist, guide rail, reusable path/sketch graph value or new scalar function is activated.

## Conclusion

Gate D — authenticated product-path acceptance — is **complete**.

Together with the previously accepted repository/CI, pinned native runtime and installed Rhino 8 / Grasshopper gates, all required acceptance layers for the bounded planar elbow sweep are now closed.
