# M3A Rhino 8 / Grasshopper runtime evidence — 2026-09-11

Status: **partial installed-host acceptance — open/solve and parameter-driven Y-normal mirror movement accepted; save/close/reopen pending**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Accepted host evidence

A fresh current-branch GHX containing a parameter-backed canonical `mirror` node was opened in the installed Rhino 8 / Grasshopper host.

The tested graph uses a published `MirrorOffset` input driving a Y-normal mirror plane. Grasshopper opened the definition, solved it without a script/runtime error, and produced the reflected box as the Result Brep.

The user exercised clearly different slider states, including the visible range endpoints `-20` and `20`. The resulting box visibly moved along the Rhino Y direction as `MirrorOffset` changed.

This is the orientation-sensitive host case selected specifically to verify parity with the native mapping:

```text
canonical normalAxis: y
canonical plane: Y = MirrorOffset
native backend: Plane.ZX.offset(MirrorOffset)
Rhino backend: explicit plane with +Y normal at Y = MirrorOffset
```

The observed parameter-driven movement confirms that the installed Rhino compiler is not stuck on a zero plane and that the mirror offset is wired through the Grasshopper input.

## Evidence supplied

Two installed-host screenshots show the same generated Grasshopper definition with `MirrorOffset` connected to the Brepia Python component and the reflected box at distinguishable Y positions for different slider values.

## Remaining persistence check

M3A is not yet fully closed. The same GHX still needs one persistence check:

```text
save
-> close
-> reopen
-> definition still solves
-> MirrorOffset remains connected and continues to move the reflected Result Brep
```

Once that is confirmed, the installed-host acceptance gate is complete and M3A can be explicitly closed before M3B begins.
