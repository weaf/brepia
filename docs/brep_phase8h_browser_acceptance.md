# BRep Phase 8H — GHX browser/product round-trip acceptance

## Status

**Accepted in the real local browser/runtime on 2026-09-07.**

Phase 8A–8G established the repository implementation and CI evidence. Phase 8H has now also proven the complete user-facing Brepia-side round trip through the real browser UI.

Installed Rhino/Grasshopper open/solve acceptance remains separate Phase 9 work in `docs/brep_phase9_rhino_acceptance.md`.

## Purpose

Verify the complete Brepia-side loop through the real browser UI:

```text
prompt
  -> AI creates supported canonical BRep project
  -> Brepia native 3D preview
  -> user exports .GHX through UI
  -> supported GHX parameter value is edited
  -> user imports returned .GHX through UI
  -> Brepia creates a new immutable revision
  -> user explicitly activates that revision
  -> parameter state and native 3D preview update
```

This phase intentionally does **not** claim that Grasshopper itself opened or solved the exported document. That host-runtime evidence belongs to Phase 9.

## Acceptance model

Use a deliberately narrow project inside the currently proven GHX executable subset:

- exactly one canonical `box` result node;
- published numeric `width` parameter, default 1200 mm, bounds 600–1800 mm, step 100;
- published numeric `height` parameter, default 2100 mm, bounds 1500–2400 mm, step 100;
- literal 600 mm depth;
- no transform, cylinder, subtract, fillet, auxiliary semantic geometry or placement change.

The supported returned edit for the acceptance run is:

```text
width: 1200 -> 1500 mm
```

The change represents the same state change a user can make in Grasshopper by changing the Brepia-generated Width slider. The browser harness edits the downloaded textual GHX directly so this Brepia-side acceptance does not depend on Rhino workstation availability.

## Automated local browser harness

Files:

- `playwright.brep-ghx.config.ts`
- `tests/brep_ghx_roundtrip.acceptance.ts`

Run against the real local application/runtime:

```bash
BREP_GHX_EMAIL='...' \
BREP_GHX_PASSWORD='...' \
npx playwright test -c playwright.brep-ghx.config.ts
```

`B9_EMAIL` / `B9_PASSWORD` are also accepted for compatibility with the existing browser acceptance credentials.

Optional origin override:

```bash
BREPIA_ACCEPTANCE_ORIGIN='http://localhost:3002'
```

## Required assertions

The harness must fail unless all of the following are true:

1. real UI sign-in succeeds;
2. `/brep` exposes `Create native BRep with AI`;
3. the prompt creates a persisted native BRep project and navigates to `/brep/<conversation-id>`;
4. Width is 1200 mm and native 3D preview renders;
5. `.GHX` is selectable and downloadable from the existing BRep export control;
6. the downloaded artifact is textual GHX and contains Brepia executable content;
7. changing only the supported Width value to 1500 produces a returned GHX accepted by the UI import control;
8. import reports exactly one supported parameter change;
9. a new immutable revision appears but does not become active automatically;
10. selecting the imported revision makes it active;
11. Width becomes 1500 mm in Brepia;
12. native BRep preview renders for the imported state.

A successful run writes `brep-ghx-roundtrip-accepted.png` as visual evidence.

## Acceptance evidence — 2026-09-07

The real local Playwright run passed the complete flow above against the real authenticated Brepia application and native BRep runtime.

The acceptance exercise exposed and corrected two integration defects before the final pass:

1. the browser harness still targeted the obsolete sign-in selector `#email`; it now uses the current `#identifier` field;
2. GHX import inserted an immutable message revision, but the database `update_leaf_trigger` automatically advanced `conversations.current_message_leaf_id` to every newly inserted message. The import persistence path now restores the pre-import active leaf with a compare-and-swap update only while the leaf still points to the imported revision, so it cannot overwrite a genuinely newer user/AI leaf.

Final browser evidence:

```text
real UI sign-in                         PASS
AI creates supported canonical box     PASS
native Brepia 3D preview               PASS
GHX export through product UI          PASS
Width 1200 -> 1500 returned edit       PASS
GHX import through product UI          PASS
new immutable revision                 PASS
imported revision initially inactive   PASS
explicit revision activation           PASS
Width = 1500 after activation          PASS
native preview after activation        PASS
```

Repository gates on product-fix checkpoint `26b303ffad38f5aee062dda11173044831308466`:

- Quality Gate #546 / run `34136092218` — PASS;
- Grasshopper Build #119 / run `34136092167` — PASS.

Phase 8 is therefore **Brepia-side product-accepted for the strict v1 GHX subset**.

## Failure policy

Do not weaken the deterministic GHX validator merely to make browser acceptance pass.

If the flow fails:

- AI creation failure -> investigate BRep creation/model instruction boundary;
- native preview failure -> investigate accepted BRep evaluator/runtime;
- export UI failure -> investigate Phase 8F product integration;
- returned parameter-only GHX rejection -> investigate compiler/validator equivalence;
- import persistence/history failure -> investigate Phase 8G lifecycle;
- preview does not follow explicitly activated imported revision -> investigate BRep revision selection/evaluation lifecycle.

Unknown GHX graph/script/wiring/runtime mutations remain unsupported and must continue to fail closed.

## Phase boundary

Phase 8 is now Brepia-side product-accepted for the strict v1 subset.

This does not make the stacked Phase 8 pull request independently mergeable while its Phase 7 base pull request remains intentionally open/draft. Repository integration must preserve that branch boundary.

Phase 9 adds only the missing real Rhino 8 / Grasshopper host evidence:

```text
Brepia-exported GHX
  -> open/solve in Grasshopper
  -> change supported generated parameter
  -> save GHX
  -> Brepia Phase 8H import path
```
