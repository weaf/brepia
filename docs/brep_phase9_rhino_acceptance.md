# BRep Phase 9 — installed Rhino / Grasshopper product-loop acceptance

Status: **CLOSEOUT IN PROGRESS — operation-level Rhino evidence is broad; the remaining gap is one current-product end-to-end round trip through real Rhino-saved GHX, Brepia import/activation, AI continuation and fresh GHX reopen.**

Date: 2026-09-14

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Purpose

Phase 9 is the installed-host acceptance layer for the existing zero-install GHX product architecture.

The target loop is:

```text
Brepia AI
  -> canonical BRep model
  -> native Brepia preview
  -> current-product GHX export
  -> installed Rhino 8 / Grasshopper open + solve
  -> supported parameter edits
  -> save + close + reopen + solve
  -> Rhino-saved GHX returned to Brepia
  -> strict parameter-only import
  -> new immutable inactive revision
  -> explicit activation
  -> native Brepia preview
  -> continued Brepia AI edit
  -> fresh current-product GHX export
  -> installed Rhino 8 / Grasshopper reopen + solve
```

Phase 9 does not broaden the canonical schema or the supported GHX return contract.

## Reconciliation against the current branch

The older 2026-09-09 Phase 9 text predated the later modeling-capability work and is no longer an accurate description of the repository-supported Rhino compiler surface.

Since that checkpoint, separate Gate-A/B/C work has accepted additional canonical behavior including the M1 scalar AST, additive Booleans, mirror, bounded linear/rectangular/circular patterns, M4 profile extrusion, M6 non-zero rotation parity, bounded full revolve and bounded multi-loop profile extrusion.

Those operation-specific Gate-C records are valid installed-host evidence for the exact graphs they exercise. They do **not** by themselves close the Phase 9 product loop because they are compiler/fixture acceptance rather than one continuous product export -> Rhino save -> Brepia import -> AI continuation -> fresh Rhino reopen sequence.

Likewise, `docs/brep_phase8h_browser_acceptance.md` already proves the Brepia-side strict v1 lifecycle in the real authenticated browser/runtime:

- native BRep creation;
- native preview;
- GHX product export;
- parameter-only GHX import;
- new immutable imported revision;
- imported revision initially inactive;
- explicit activation;
- recovered parameter value;
- native preview after activation.

That Phase 8H run edited textual GHX directly and therefore is not a substitute for importing a file genuinely saved by Rhino/Grasshopper.

The 2026-09-14 bounded multi-loop Gate-C run additionally proves that a Rhino-saved GHX can survive save -> close -> reopen and pass the strict parameter-only returned-GHX validator. That fixture was not created through the complete Brepia product/UI loop, so it also remains supporting evidence rather than final Phase 9 closeout evidence.

## Reconciled 12-step acceptance matrix

The original Phase 9 acceptance sequence remains the correct product boundary, but the current evidence state is now:

| Step | Requirement | Current evidence | Final closeout requirement |
| --- | --- | --- | --- |
| 1 | create supported canonical model + native preview | Phase 8H accepted | rerun on current product path as part of staged closeout |
| 2 | export GHX from saved immutable Brepia revision | Phase 8H accepted | rerun on current product path |
| 3 | open generated GHX in installed Rhino 8 / Grasshopper | repeatedly accepted by later Gate-C fixtures | use the exact current-product export from step 2 |
| 4 | standard controls + built-in Python 3 carrier load without Brepia GHA | accepted installed-host architecture | verify on exact current-product export |
| 5 | solve expected native Rhino Brep geometry | broadly accepted operation-level | verify exact closeout box |
| 6 | change at least two published parameters | accepted in later host fixtures | perform Width 1200 -> 1500 and Height 2100 -> 2300 |
| 7 | save -> close -> reopen -> solve | accepted in later host fixtures | perform on the exact current-product closeout GHX |
| 8 | return Rhino-saved GHX to Brepia | strict validator accepted on fixture | import the exact host-saved current-product GHX through browser UI |
| 9 | deterministic compatibility validation + parameter recovery | Phase 8H accepted for textual edit | prove from real Rhino-saved file; exactly two changes |
| 10 | activate imported immutable revision + native preview | Phase 8H accepted | prove in same real-host closeout run |
| 11 | continue editing canonical model with Brepia AI | repository/product chat exists | prove after activation in same closeout run |
| 12 | export fresh GHX and reopen/solve in installed Rhino 8 / Grasshopper | operation fixtures prove compiler path | prove from the AI-continued revision |

Therefore the remaining work is not another geometry mapping project. It is one controlled current-product end-to-end acceptance run.

## Dedicated closeout harness

The closeout harness is deliberately split around the real Rhino workstation boundary:

```text
scripts/brep/phase9-roundtrip.sh prepare
  -> browser creates current canonical box
  -> native preview
  -> current-product GHX export
  -> writes manifest + phase9-source.ghx

installed Rhino 8 / Grasshopper
  -> open phase9-source.ghx without repair
  -> verify one box Result
  -> Width 1200 -> 1500
  -> Height 2100 -> 2300
  -> verify recomputation
  -> save as phase9-host-saved.ghx
  -> close Rhino/Grasshopper
  -> reopen saved file
  -> solve again

scripts/brep/phase9-roundtrip.sh finalize
  -> browser opens the same persisted Brepia conversation
  -> imports the actual Rhino-saved GHX
  -> requires exactly two supported parameter changes
  -> requires one new immutable imported revision
  -> requires imported revision to remain inactive initially
  -> explicitly activates imported revision
  -> requires Width=1500 and Height=2300
  -> requires native preview
  -> asks Brepia AI to change only literal box depth 600 -> 700
  -> requires one new active AI revision
  -> requires Width/Height values to remain 1500/2300
  -> exports phase9-continued.ghx
  -> verifies generated GHX contains literal 700 depth plus persisted 1500/2300 controls

installed Rhino 8 / Grasshopper
  -> open phase9-continued.ghx without repair
  -> solve
  -> verify expected 1500 x 700 x 2300 box
```

Implementation files:

```text
tests/brep_phase9_roundtrip.acceptance.ts
playwright.brep-phase9.config.ts
scripts/brep/phase9-roundtrip.sh
```

Default evidence directory:

```text
test-results/phase9-roundtrip/
```

The harness writes:

```text
manifest.json
phase9-source.ghx
phase9-prepare.png
phase9-host-saved.ghx        # supplied by installed Rhino host
phase9-continued.ghx
phase9-finalize.png
```

## Running the closeout

Use the existing authenticated local acceptance credentials:

```bash
export BREP_GHX_IDENTIFIER='...'
export BREP_GHX_PASSWORD='...'
```

`BREP_GHX_EMAIL` or the historical `B9_EMAIL` / `B9_PASSWORD` names remain accepted.

Optional application origin override:

```bash
export BREPIA_ACCEPTANCE_ORIGIN='http://localhost:3002'
```

### Stage 1 — prepare current-product export

```bash
./scripts/brep/phase9-roundtrip.sh prepare
```

Open:

```text
test-results/phase9-roundtrip/phase9-source.ghx
```

in installed Rhino 8 / Grasshopper.

Required host observations:

1. opens without repair prompt;
2. built-in Python 3 component loads without Brepia GHA;
3. exactly one box Result solves;
4. Width = 1200 and Height = 2100 initially;
5. change Width to 1500;
6. change Height to 2300;
7. geometry recomputes correctly;
8. save as `phase9-host-saved.ghx`;
9. close Rhino/Grasshopper;
10. reopen the saved file and solve again;
11. edited geometry and controls remain correct.

Place/copy the saved file at:

```text
test-results/phase9-roundtrip/phase9-host-saved.ghx
```

or pass an explicit path to the finalize command.

### Stage 2 — Brepia import, activation, AI continuation and fresh export

Default returned-file location:

```bash
./scripts/brep/phase9-roundtrip.sh finalize
```

Explicit returned file:

```bash
./scripts/brep/phase9-roundtrip.sh finalize /path/to/rhino-saved.ghx
```

The browser stage fails unless the actual host-saved document is accepted as exactly two supported parameter changes, becomes a new inactive immutable revision, activates explicitly, renders natively, survives AI continuation and emits a fresh GHX with the requested continued depth.

### Stage 3 — final installed-host reopen

Open:

```text
test-results/phase9-roundtrip/phase9-continued.ghx
```

Required final host observations:

- opens without repair prompt;
- solves successfully;
- Result remains an ordinary single box Brep;
- dimensions are the expected 1500 x 700 x 2300 mm;
- Width and Height controls remain 1500 and 2300.

After those observations are recorded, Phase 9 can be closed with a dedicated runtime-evidence document and exact repository/CI checkpoint.

## Strict compatibility boundary

The closeout harness intentionally exercises only the already-supported parameter-only GHX return contract.

Still unsupported for canonical round trip unless separately implemented and accepted:

- arbitrary new Grasshopper components that affect Brepia-owned semantics;
- rewiring Brepia-owned inputs through unknown logic;
- edited embedded Brepia script/runtime code;
- arbitrary plug-in components;
- generic Grasshopper graph -> canonical `BrepProject` reconstruction.

Unsupported returned content must continue to fail closed. Phase 9 completion must not weaken the strict validator merely to accept a host-saved document.

## Evidence policy

Keep these evidence classes distinct:

1. repository/CI proves the deterministic harness and product code;
2. installed Rhino 8 / Grasshopper proves open/solve/edit/save/reopen behavior;
3. authenticated browser/runtime proves returned-file import, immutable revision semantics, explicit activation, native preview and AI continuation.

The final Phase 9 closeout document must record the exact branch/head, CI runs, source and continued GHX filenames, parameter edits, browser acceptance output and installed-host observations. If the exact Rhino 8 point release is not captured, record only the supported installed target `Rhino 8` rather than inventing a version.
