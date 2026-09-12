# M6 native build123d / OCCT runtime evidence

Status: **accepted**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Tested checkpoint:

```text
ecfd9fea3209281e00ab9d31752087d3315bfea3
Record M6 rotation parity repository status
```

The underlying M6 code checkpoint immediately below that documentation-only commit is:

```text
3fd9c38910baac956e1a67b710bcc41f31b3b0e0
Lock native M6 rotation smoke contract
```

CI on the exact tested checkpoint `ecfd9fea...`:

```text
Quality Gate #991       PASS
Grasshopper Build #563 PASS
```

The underlying code checkpoint `3fd9c389...` had already passed:

```text
Quality Gate #990       PASS
Grasshopper Build #562 PASS
```

## Runtime

The full native smoke suite was executed locally against the pinned Brepia build123d / OCCT runtime using:

```text
localhost/brepia-brep:build123d-0.11.1
```

The native driver is bind-mounted from the tested checkout by `scripts/brep/pcad-brep-sandbox`, so the execution used the M6 driver source from the tested branch while retaining the pinned build123d / OCCT environment.

Command:

```bash
./scripts/brep/smoke-test.sh
```

The user reported the complete command **green** with no failing fixture.

## M6 assertions exercised by the passing smoke

The M6 portion is `scripts/brep/m6-rotation-smoke.sh`, invoked from the normal full smoke suite rather than as an isolated permissive test.

The source solid is an asymmetric centered box:

```text
width  = 10
 depth  = 20
height = 30
```

### Single-axis rotations

The passing runtime verified the native `Location(translation, rotation)` behavior for all three positive 90-degree axis rotations:

```text
X 90:
[-5,-15,-10] -> [5,15,10]

Y 90:
[-15,-10,-5] -> [15,10,5]

Z 90:
[-10,-5,-15] -> [10,5,15]
```

Each case remained one canonical `single` result and retained exact STEP availability.

### Asymmetric Intrinsic XYZ + translation

The passing runtime also exercised the order-sensitive fixture:

```text
rx = 30
ry = ryBase + 5 = 20
rz = 10
T  = [7,11,13]
```

The effective rotation therefore included both:

- a direct published degree parameter;
- a bounded M1 expression-backed degree value.

The passing bounds were the repository-locked native expectations:

```text
min [-4.38914415,-5.87340299,-5.66971729]
max [18.38914415,27.87340299,31.66971729]
```

This accepts the native transform convention used for M6:

```text
rotateDeg = [rx, ry, rz]
Intrinsic XYZ
R = Rx * Ry * Rz
p' = R * p + T
```

The result remained one `single` body and exact STEP remained available.

## Regression coverage in the same native run

Because M6 is appended to `scripts/brep/smoke-test.sh`, the same reported-green run also re-exercised the existing M0-M4 native cases, including:

- base primitive / project-object / exact artifact behavior;
- union and intersect success plus disjoint fail-closed behavior;
- M3A axis mirrors;
- M3B ordered linear-pattern `instanceSet` output;
- M3B pattern-as-subtract-tools returning `single`;
- M4 rectangle extrusion on X/Y/Z;
- M4 circle and closed-polyline extrusion;
- exact STEP checks and 3DM checks where those fixtures require them.

No native regression was reported.

## Acceptance conclusion

M6 native build123d / OCCT runtime parity is **accepted** for the current bounded transform contract.

This evidence establishes the authoritative native side only. It does **not** by itself prove installed Rhino 8 / Grasshopper parity. Fresh current-branch GHX still needs to be opened, solved, parameter-perturbed, saved, closed and reopened in the installed Rhino 8 host, followed by strict returned-GHX validation.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
