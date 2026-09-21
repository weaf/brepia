# Bounded planar elbow sweep — installed Rhino 8 / Grasshopper runtime evidence

Status: **accepted**

Date: 2026-09-21

Repository: `weaf/brepia`

Branch: `feature/brep-planar-elbow-sweep`

## Scope

This evidence closes Gate C for the bounded planar 90-degree circular sweep.

Repository/native evidence remains separate. This document records only installed Rhino 8 / Grasshopper host acceptance and strict validation of the Rhino-saved returned GHX.

The fixture and acceptance tooling came from:

```text
533eb64ba51700bdb2a227164b9499988e3fd2fa
Add sweep Rhino Gate C acceptance tooling
```

The generated fixture was:

```text
sweep-planar-elbow-z.ghx
```

and the host-saved return was:

```text
sweep-planar-elbow-z-returned.ghx
```

## Installed-host acceptance

The definition was opened and solved in installed Rhino 8 / Grasshopper.

Observed host geometry showed:

- one continuous constant-circular-section result;
- one straight first leg;
- one smooth tangent 90-degree elbow;
- one straight second leg;
- no box/cylinder approximation of the bend;
- no visible kink or faceting at the line-to-arc transitions.

The operator-provided acceptance screenshot showed the recomputed red Rhino/Grasshopper preview as one continuous elbow matching the locked canonical path shape.

The published controls were then set to:

```text
Bend radius   = 180 mm
Tube diameter = 50 mm
```

The modified definition was saved back as the returned GHX.

## Strict returned-GHX validation

Validation was run on Dquark through the repository-owned acceptance script using the Dquark-Control finite-job path:

```text
request_id=brepia-sweep-gatec-validate-20260921-02
operation=herdr-job-run
run_status=completed
run_rc=0
```

GitHub Actions evidence:

```text
Dquark Control run 35632770539
conclusion=success
```

The validator reported:

```json
{"returnedValidation":"accepted","fixture":{"filename":"sweep-planar-elbow-z-returned.ghx","parameters":{"bendRadius":180,"tubeDiameter":50},"expectedResultAccess":"Item"}}
```

and the focused acceptance test passed:

```text
tests/brepSweepRhinoAcceptanceTool.test.ts
1 passed
```

The returned definition therefore preserves the expected bounded parameter shell and Result Item access while carrying the actual host-saved non-default values.

## Diagnostic first return

The first host-saved return was intentionally not accepted because the saved controls did not match the requested perturbation:

```text
Expected tubeDiameter=50, got 100.
```

Dquark-Control classified that execution as:

```text
failure_class=product-or-test
failure_stage=herdr-job-command
```

No product code was changed in response. The host values were corrected and the same strict validator then passed. This demonstrates that the returned-GHX validator was reading the persisted host values rather than accepting the generated defaults blindly.

## Preserved boundary

This acceptance does not broaden the sweep slice.

It still proves only:

- circular profile;
- one planar line + tangent 90-degree arc + line centerline;
- fixed canonical path frame;
- bounded Bend Radius and Tube Diameter controls;
- Result Item semantics;
- strict parameter-only returned-GHX acceptance.

It does not authorize arbitrary paths, arbitrary bend angles, multiple bends, non-planar rails, non-circular profiles, twist/frame controls, guide rails or a reusable path/sketch graph value.

## Relationship to native evidence

Gate B was accepted separately in:

```text
docs/brep_sweep_native_runtime_evidence_2026-09-19.md
```

That evidence remains the authoritative build123d / OCCT geometry-runtime proof. Installed Rhino acceptance does not override a native failure.

## Conclusion

Gate C — installed Rhino 8 / Grasshopper acceptance — is **complete**.

Gate D, the authenticated Native BRep product-path rerun of the original target-E request, remains required before the bounded sweep implementation can be closed.
