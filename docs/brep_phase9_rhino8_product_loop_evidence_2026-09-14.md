# BRep Phase 9 — Rhino 8 / Grasshopper full product-loop evidence

Status: **accepted**

Date: 2026-09-14

Repository: `weaf/brepia`

Current repository authority: `master`

Release integration: `v1.5.0` at `e648879f5eade3729451596dcee38b5e7b9c007b`

Historical acceptance branch: `feature/brep-grasshopper-gh-packaging`

PR #36 was later merged into `master` for the v1.5.0 release. The former stacked feature branches have been removed; the branch references below are retained only where they identify historical acceptance evidence.

## Scope

This document closes the installed-host/product-loop acceptance boundary for Phase 9.

The accepted loop is:

```text
Brepia AI
  -> canonical BRep project
  -> native Brepia preview
  -> current-product GHX export
  -> installed Rhino 8 / Grasshopper open + solve
  -> Width/Height edits
  -> save + close + reopen + solve
  -> Rhino-saved GHX returned to Brepia
  -> strict parameter-only import
  -> new immutable inactive revision
  -> explicit activation
  -> native Brepia preview
  -> Brepia AI continuation
  -> fresh GHX export
  -> installed Rhino 8 / Grasshopper reopen + solve
```

Phase 9 does not broaden canonical BRep semantics and does not weaken the strict returned-GHX boundary.

## Repository / CI checkpoint before closeout documentation

The current implementation/harness checkpoint used for the final acceptance was:

```text
1ea43281010299f1069f8190c6048626fcbedb96
Make Phase 9 finalize resumable
```

Exact repository CI on that checkpoint:

```text
Quality Gate #1120      PASS
Grasshopper Build #692 PASS
```

Repository CI is evidence for the repository implementation and deterministic build/test surface only. It is not treated as installed Rhino evidence.

## Current-product prepare stage

The Phase 9 prepare path created a dedicated persisted BRep project named:

```text
Phase 9 Round Trip Box
```

Canonical starting model:

- exactly one box node;
- published `width` parameter, label `Width`, default `1200`, bounds `600..1800`, step `100`;
- published `height` parameter, label `Height`, default `2100`, bounds `1500..2400`, step `100`;
- box X driven by `width`;
- box Y/depth literal `600`;
- box Z driven by `height`;
- no auxiliary geometry, transform, Boolean, fillet or placement change.

The current product path successfully produced native Brepia preview geometry and exported:

```text
test-results/phase9-roundtrip/phase9-source.ghx
```

The exported GHX preserved the expected 1200 / 2100 published controls and the generated Rhino script contained the literal box depth `600`.

## Installed Rhino 8 / Grasshopper middle gate

The exact current-product source GHX was opened in installed Rhino 8 / Grasshopper.

Accepted host observations:

- the GHX opened without repair;
- the built-in Rhino 8 Python 3 carrier loaded without a Brepia GHA dependency;
- the definition solved successfully;
- the result was the expected ordinary single box Brep;
- initial published controls were Width `1200` and Height `2100`;
- Width was changed `1200 -> 1500`;
- Height was changed `2100 -> 2300`;
- geometry recomputed correctly after both changes;
- the document was saved as `phase9-host-saved.ghx`;
- the Grasshopper document was closed;
- the Rhino-saved document was reopened;
- the reopened document solved successfully again;
- Width `1500`, depth `600` and Height `2300` remained persisted after reopen.

Returned host file:

```text
test-results/phase9-roundtrip/phase9-host-saved.ghx
```

## Brepia returned-GHX lifecycle

The Rhino-saved GHX was then returned through the real Brepia product UI.

Accepted observations:

- the returned file was accepted through the existing strict parameter-only GHX import boundary;
- the returned document represented exactly the supported Width and Height changes;
- Brepia created a new immutable revision;
- the imported revision remained inactive initially;
- the imported revision was explicitly activated by the user;
- Width became `1500` and Height became `2300` from the activated imported revision;
- native Brepia preview rendered the imported parameter state correctly.

This preserves the Phase 8H lifecycle contract while adding the previously missing evidence that the returned document was genuinely saved by installed Rhino / Grasshopper.

## Brepia AI continuation after host return

With the Rhino-imported revision active, Brepia AI was asked to continue the canonical model by changing only the literal box Y/depth dimension:

```text
600 -> 700 mm
```

Accepted observations:

- the continuation operated on the imported active canonical BRep state;
- Width remained `1500`;
- Height remained `2300`;
- the existing published Width/Height parameter definitions were preserved;
- the result remained exactly one box;
- no new parameter or node was introduced;
- the depth changed to `700`;
- a fresh current-product GHX was exported from the AI-continued revision.

The exact local filename of the manually exported final GHX was not captured in the acceptance transcript, so this record does not invent one. The automated harness target name `phase9-continued.ghx` is therefore not used as evidence for the final manual host gate.

## Final installed Rhino 8 / Grasshopper gate

The fresh GHX exported from the AI-continued Brepia revision was opened again in installed Rhino 8 / Grasshopper.

Accepted final observations:

- the fresh GHX opened without repair;
- the definition solved successfully;
- the result remained an ordinary single box Brep;
- Width remained `1500`;
- Height remained `2300`;
- box depth was `700`;
- final geometry was therefore `1500 x 700 x 2300` mm.

This closes the missing final link from returned Rhino document, through canonical Brepia AI continuation, back to a newly exported document solving in the installed host.

## Automation note — not product acceptance evidence

The staged Playwright closeout harness remains useful for deterministic setup and regression work, but its `finalize` stage was not used as the final acceptance authority.

During repeated acceptance attempts, the harness exposed test-state assumptions around revision-history UI transitions and retry state:

- revision selection can collapse/remount the revision-history UI, invalidating locators held across the transition;
- a failed attempt may already have activated the imported revision, so a retry can begin from `1500 / 2300` rather than the original `1200 / 2100` state;
- after multiple retries, positional assumptions such as "first/newest revision" are not sufficiently deterministic for identifying the revision created by the current import attempt.

These are acceptance-harness robustness issues. They did not invalidate the manually observed product behavior above.

The harness must not be reported as fully green until its revision identification/retry semantics are made deterministic. That follow-up is test infrastructure work and must not weaken or bypass product revision semantics merely to make Playwright pass.

## Strict compatibility boundary preserved

The accepted loop exercised only the already-supported parameter-only GHX return contract.

Still unsupported unless separately implemented and accepted:

- arbitrary new Grasshopper components affecting Brepia-owned semantics;
- rewiring Brepia-owned inputs through unknown logic;
- edits to the embedded Brepia script/runtime code;
- arbitrary plug-in components;
- generic Grasshopper graph -> canonical `BrepProject` reconstruction.

Unsupported returned content continues to fail closed.

## Evidence separation

The Phase 9 closeout keeps the three evidence classes distinct:

1. repository/CI: checkpoint `1ea43281010299f1069f8190c6048626fcbedb96`, Quality Gate #1120 PASS, Grasshopper Build #692 PASS;
2. authenticated Brepia product/runtime: current-product creation/export, strict host-return import, immutable inactive revision, explicit activation, native preview and AI continuation;
3. installed Rhino 8 / Grasshopper: current-product source open/solve, parameter edits, save/close/reopen/solve and final fresh-GHX reopen/solve at `1500 x 700 x 2300`.

No exact Rhino 8 point release was captured, so this document records only the verified installed target `Rhino 8`.

## Conclusion

Phase 9 installed Rhino 8 / Grasshopper full product-loop acceptance is **complete**.

The complete current-product loop has now been observed across the actual product and installed host without weakening canonical authority or the strict GHX return boundary.

The remaining Playwright retry/revision-identification issue is a separate harness-hardening backlog item and is not an open Phase 9 product acceptance gap.

PR #36 and its stacked Phase 7 dependency are now integrated into `master` through the v1.5.0 release; this document remains the historical installed-host acceptance record.
