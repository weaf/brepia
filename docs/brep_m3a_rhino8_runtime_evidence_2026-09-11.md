# M3A Rhino 8 / Grasshopper runtime evidence — 2026-09-11

Status: **accepted — installed Rhino 8 / Grasshopper runtime**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Accepted host evidence

A fresh current-branch GHX containing a parameter-backed canonical `mirror` node was opened in the installed Rhino 8 / Grasshopper host.

The tested graph used a published `MirrorOffset` input driving a Y-normal mirror plane:

```text
canonical normalAxis: y
canonical plane: Y = MirrorOffset
native backend: Plane.ZX.offset(MirrorOffset)
Rhino backend: explicit plane with +Y normal at Y = MirrorOffset
```

Grasshopper opened the definition, solved it without a script/runtime error, and produced the reflected box as the Result Brep.

The user exercised clearly different slider states, including `-20` and `20`. The resulting box visibly moved along the Rhino Y direction as `MirrorOffset` changed. This is the orientation-sensitive case selected specifically to verify parity with the native build123d mapping and confirms that the installed Rhino compiler is not accidentally pinned to a zero plane or using the wrong offset sign.

## Persistence acceptance

The same generated GHX was then saved, closed and reopened in the installed Grasshopper host.

After reopening:

- the definition still solved successfully;
- `MirrorOffset` remained connected to the generated Brepia Python component;
- the Result Brep remained valid;
- changing `MirrorOffset` continued to move the reflected box in Y.

This completes the required installed-host sequence:

```text
Brepia export
-> GHX open/solve
-> parameter-driven mirror movement
-> save
-> close
-> reopen
-> still solves with the same parameter wiring
```

## Evidence supplied

Two installed-host screenshots showed the same generated Grasshopper definition with `MirrorOffset` connected to the Brepia Python component and the reflected box at distinguishable Y positions for different slider values. The user then explicitly confirmed successful save/close/reopen persistence and continued parameter control.

## Conclusion

M3A installed Rhino 8 / Grasshopper runtime parity is accepted.

Together with the repository/CI acceptance and the real build123d/OCCT native smoke evidence, this satisfies the full M3A mirror acceptance contract. M3A can be explicitly closed and M3B instance-set / linear-pattern contract analysis may begin.
