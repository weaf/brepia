# A-CI-001 — Always-present Grasshopper interoperability merge gate

Date: 2026-09-23

Status: **CLOSED ON HARDENING BRANCH — AWAITING MERGE TO MASTER**

Branch: `hardening/foundation-b1`

Implementation checkpoint:

`42ec7a62f88e57711b3194ac97817ad61d47e6d1`

`Make Grasshopper CI gate always present`

Assertion hardening checkpoint:

`ebacf7374ebdff64e65705133ca459047a533731`

`Harden BRep UI source assertions`

Draft integration PR:

`#52 — Harden Grasshopper CI merge gate`

## Finding

The Grasshopper interoperability workflow previously used workflow-level path filtering.

That meant a pull request without Grasshopper-related changes could receive no Grasshopper status check at all. A check that is absent on some pull requests is not safe to configure as a required branch-protection check.

Phase A therefore identified a merge-gate gap: interoperability-sensitive changes had CI coverage, but the gate itself was not guaranteed to exist for every pull request.

## Change

`.github/workflows/grasshopper-build.yml` now runs on every pull request.

A cheap `Grasshopper change detection` job classifies whether the pull request touches the accepted interoperability surface.

Relevant paths are bounded to:

- `grasshopper/**`;
- `shared/brepGrasshopperPackagePlan.ts`;
- `tests/brepGrasshopperPlugin.test.ts`;
- `tests/brepGrasshopperPackaging.test.ts`;
- `tests/brepGrasshopperPackagePlan.test.ts`;
- `.github/workflows/grasshopper-build.yml`.

When the change is relevant:

- `Plugin build` runs;
- package builds run on Ubuntu and Windows;
- the final `grasshopper-interoperability` job requires all relevant jobs to succeed.

When the change is not relevant:

- expensive plugin/package jobs are skipped;
- `grasshopper-interoperability` still exists and succeeds.

The final job uses `always()` and also fails closed if change detection itself fails.

`tests/grasshopperCiGate.test.ts` locks the workflow contract, including the final check name, dependency wiring, always-present behavior and exact relevance path set.

## Relevant-change evidence

Pull request `#52` exercised the relevant path because the workflow itself changed.

On exact head:

`ebacf7374ebdff64e65705133ca459047a533731`

Grasshopper Build run:

`35862485627`

Result:

- `Grasshopper change detection` — **PASS**;
- `Plugin build` — **PASS**;
- `Package build (ubuntu-latest)` — **PASS**;
- `Package build (windows-latest)` — **PASS**;
- `grasshopper-interoperability` — **PASS**.

Quality Gate run:

`35862485650`

Result:

- `quality` — **PASS**.

The focused source-assertion repair preceding that run also passed:

- `tests/brepProductChat.test.ts`;
- `tests/brepProjectGraphUi.test.ts`;
- 16/16 focused tests.

## Non-relevant-change evidence

Temporary draft PR `#53 — Verify non-relevant Grasshopper CI path` was created from `ebacf737` with exactly one documentation-only change.

Temporary head:

`050616e55a39b3010ed20d813a76315732473de7`

Grasshopper Build run:

`35866727161`

Result:

- `Grasshopper change detection` — **PASS**;
- `Plugin build` — **SKIPPED**;
- `Package build` — **SKIPPED**;
- `grasshopper-interoperability` — **PASS**.

Quality Gate run:

`35866727232`

Result:

- `quality` — **PASS**.

PR `#53` was then closed without merge and its temporary remote branch was deleted.

This proves the intended always-present behavior without paying the expensive interoperability build cost for unrelated changes.

## Branch protection

`master` branch protection was updated after both CI paths were proven.

Current required status checks are:

- `quality`;
- `grasshopper-interoperability`.

Both checks are bound to GitHub Actions app id `15368`, and strict status checking remains enabled.

The branch-protection mutation was performed as an add-only status-context operation and verified afterwards so the existing `quality` requirement and app binding were preserved.

Result: **PASS**.

## Transitional integration state

The required-check policy is already active on `master`, but the always-present workflow implementation is still contained in draft PR `#52` until the hardening branch is merged.

Therefore:

- A-CI-001 is technically implemented and fully verified on `hardening/foundation-b1`;
- branch protection is configured correctly;
- the policy should be considered part of the permanent `master` baseline only after PR `#52` (or an equivalent verified commit carrying the same workflow contract) is merged;
- unrelated work should not bypass or remove the new required check during this transition.

## Boundary

A-CI-001 changes CI routing and branch-protection policy only.

It does not change:

- canonical BRep/schema semantics;
- native geometry behavior;
- Rhino/GHX translation behavior;
- product templates;
- Supabase runtime isolation;
- stable runtime artifact ownership;
- dependency versions;
- application behavior outside the two source-string assertions hardened for whitespace tolerance.

A-CI-001 closes the Phase A finding that the Grasshopper interoperability gate was not safe to require globally because it could be absent on non-relevant pull requests.
