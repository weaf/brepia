# BRep Phase 9 — installed Rhino / Grasshopper product-loop acceptance

Status: **ACCEPTED / CLOSED**

Date: 2026-09-14

Repository: `weaf/brepia`

Current repository authority: `master`

Release integration: `v1.5.0` at `e648879f5eade3729451596dcee38b5e7b9c007b`

Historical acceptance branch: `feature/brep-grasshopper-gh-packaging`

PR #36 was later merged into `master` for the v1.5.0 release. The former stacked feature branches have been removed; the branch references below are retained only where they identify historical acceptance evidence.

## Purpose

Phase 9 is the installed-host acceptance layer for the existing zero-install GHX product architecture.

The accepted product loop is:

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

Phase 9 does not broaden the canonical schema or the supported returned-GHX contract.

Dedicated closeout evidence is recorded in:

```text
docs/brep_phase9_rhino8_product_loop_evidence_2026-09-14.md
```

## Reconciliation against the current branch

The older 2026-09-09 Phase 9 text predated the later modeling-capability work and no longer described the full repository-supported Rhino compiler surface.

Subsequent Gate-A/B/C work accepted additional canonical behavior including the M1 scalar AST, additive Booleans, mirror, bounded linear/rectangular/circular patterns, M4 profile extrusion, M6 non-zero rotation parity, bounded full revolve and bounded multi-loop profile extrusion.

Those operation-specific Gate-C records remain valid installed-host evidence for the exact graphs they exercise. Phase 9 required something different: one continuous current-product export -> Rhino save/reopen -> Brepia import/activation -> AI continuation -> fresh Rhino reopen sequence.

`docs/brep_phase8h_browser_acceptance.md` had already proved the Brepia-side strict v1 lifecycle in the real authenticated browser/runtime:

- native BRep creation;
- native preview;
- GHX product export;
- parameter-only GHX import;
- new immutable imported revision;
- imported revision initially inactive;
- explicit activation;
- recovered parameter value;
- native preview after activation.

Phase 8H edited textual GHX directly and therefore did not prove that a genuinely Rhino-saved document survived the full product return loop.

The bounded multi-loop Gate-C run additionally proved that Rhino-saved GHX can survive save -> close -> reopen and pass strict returned-GHX validation, but that fixture was not created through the complete Brepia product/UI loop.

Phase 9 is now closed because the missing continuous product loop has been completed in the installed host and product UI.

## Accepted 12-step matrix

| Step | Requirement                                                           | Final Phase 9 result                                                                    |
| ---- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1    | create supported canonical model + native preview                     | ACCEPTED — one-box canonical Phase 9 project created and rendered natively              |
| 2    | export GHX from saved immutable Brepia revision                       | ACCEPTED — current-product `phase9-source.ghx` exported                                 |
| 3    | open generated GHX in installed Rhino 8 / Grasshopper                 | ACCEPTED — exact current-product export opened without repair                           |
| 4    | standard controls + built-in Python 3 carrier load without Brepia GHA | ACCEPTED                                                                                |
| 5    | solve expected native Rhino Brep geometry                             | ACCEPTED — ordinary single box Brep                                                     |
| 6    | change at least two published parameters                              | ACCEPTED — Width `1200 -> 1500`, Height `2100 -> 2300`                                  |
| 7    | save -> close -> reopen -> solve                                      | ACCEPTED — values and geometry persisted                                                |
| 8    | return Rhino-saved GHX to Brepia                                      | ACCEPTED through product UI                                                             |
| 9    | deterministic compatibility validation + parameter recovery           | ACCEPTED — supported Width/Height return only                                           |
| 10   | activate imported immutable revision + native preview                 | ACCEPTED — imported revision initially inactive, then explicitly activated and rendered |
| 11   | continue editing canonical model with Brepia AI                       | ACCEPTED — only literal depth changed `600 -> 700` while Width/Height were preserved    |
| 12   | export fresh GHX and reopen/solve in installed Rhino 8 / Grasshopper  | ACCEPTED — final box `1500 x 700 x 2300` solved in installed Rhino 8 / Grasshopper      |

## Final accepted model and perturbations

Starting model:

```text
Width  = 1200 mm
Depth  = 600 mm
Height = 2100 mm
```

Installed-host parameter edits:

```text
Width  1200 -> 1500 mm
Height 2100 -> 2300 mm
```

Brepia AI continuation after host return:

```text
Depth 600 -> 700 mm
```

Final installed-host geometry:

```text
1500 x 700 x 2300 mm
```

The result remained exactly one box. Existing Width/Height parameter identities and bounds were preserved, and no new parameter or node was introduced by the continuation.

## Repository / CI evidence

The implementation/harness checkpoint immediately preceding closeout documentation is:

```text
1ea43281010299f1069f8190c6048626fcbedb96
Make Phase 9 finalize resumable
```

Exact CI on that checkpoint:

```text
Quality Gate #1120      PASS
Grasshopper Build #692 PASS
```

Repository CI proves repository implementation/build/test health. It is not treated as installed-host proof; the installed-host observations are recorded separately in the dedicated Phase 9 runtime evidence document.

## Installed-host / product evidence

The accepted closeout used the current product path and real installed Rhino 8 / Grasshopper:

1. Brepia created the dedicated Phase 9 project and native preview;
2. Brepia exported `test-results/phase9-roundtrip/phase9-source.ghx`;
3. installed Rhino 8 / Grasshopper opened and solved that exact file;
4. Width and Height were edited to `1500 / 2300`;
5. the document was saved as `test-results/phase9-roundtrip/phase9-host-saved.ghx`;
6. the saved document was closed and reopened successfully and solved again;
7. the Rhino-saved GHX was imported through the Brepia product UI;
8. Brepia created a new immutable inactive revision;
9. that revision was explicitly activated;
10. native preview showed the imported `1500 / 2300` state;
11. Brepia AI changed only depth `600 -> 700`;
12. a fresh GHX was exported from that continued canonical revision;
13. installed Rhino 8 / Grasshopper opened and solved the fresh export as `1500 x 700 x 2300`.

The exact local filename of the manually exported final GHX was not captured in the acceptance transcript, so no filename is invented for that artifact. The automated harness target name `phase9-continued.ghx` is not presented as evidence for the manual final host gate.

## Closeout harness status

The staged harness remains in the repository:

```text
tests/brep_phase9_roundtrip.acceptance.ts
playwright.brep-phase9.config.ts
scripts/brep/phase9-roundtrip.sh
```

It remains useful for setup and regression work, but the automated `finalize` stage is **not** itself accepted as fully green Phase 9 evidence.

Repeated retries exposed harness assumptions around revision-history state:

- revision activation can remount/collapse the revision-history UI;
- a failed attempt can leave the imported revision active for the next retry;
- after multiple retries, positional assumptions such as newest/first revision are not deterministic enough to identify the revision created by the current import attempt.

Those are test-harness robustness issues, not a product acceptance gap. They remain separate follow-up work and must not be solved by weakening immutable revision, activation or strict GHX semantics.

## Strict compatibility boundary

The accepted closeout exercised only the already-supported parameter-only GHX return contract.

Still unsupported for canonical round trip unless separately implemented and accepted:

- arbitrary new Grasshopper components that affect Brepia-owned semantics;
- rewiring Brepia-owned inputs through unknown logic;
- edited embedded Brepia script/runtime code;
- arbitrary plug-in components;
- generic Grasshopper graph -> canonical `BrepProject` reconstruction.

Unsupported returned content must continue to fail closed.

## Evidence policy

The accepted evidence remains intentionally separated:

1. repository/CI proves deterministic repository implementation/build/test health;
2. authenticated Brepia browser/runtime proves import, immutable revision semantics, explicit activation, native preview and AI continuation;
3. installed Rhino 8 / Grasshopper proves open/solve/edit/save/reopen behavior and the final fresh-GHX solve.

No exact Rhino 8 point release was captured, so only the verified installed target `Rhino 8` is recorded.

## Conclusion

Phase 9 installed Rhino / Grasshopper product-loop acceptance is **complete and closed**.

The exact missing boundary has now been demonstrated:

```text
current Brepia product export
-> real Rhino save/reopen
-> Brepia strict return + explicit activation
-> canonical AI continuation
-> fresh Brepia GHX
-> real Rhino reopen/solve
```

No new geometry/modeling slice should be started until the post-Phase-9 / post-multi-loop scope decision is recorded separately.

PR #36 and its stacked Phase 7 dependency are now integrated into `master` through the v1.5.0 release; this document remains the historical installed-host acceptance record.
