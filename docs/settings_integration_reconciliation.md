# Settings integration — completion and master reconciliation

Status: **REPAIR B1-B9 COMPLETE; MASTER RECONCILIATION REQUIRED**

Branch: `local-dev-continue`

Reviewed: 2026-08-18

## Completion state

The Models / Prompts / Providers repair work B1-B9 is functionally complete on `local-dev-continue`.

Evidence recorded in the branch:

- automated integration/regression suite: 137 tests passing before B9;
- Playwright B9 run: 24/24 scenarios passing in Chromium;
- visual audit completed at 1280x800 and approximately 390px;
- Models, Prompts and Providers passed the visual audit;
- CADAM Original shows the real prompt and remains read-only while Edit creates Overlay/Fork profiles;
- Runtime Integrations are separated from custom providers;
- signed-in Settings flows no longer show Unauthorized failures;
- a missing local `prompt_profiles` migration was discovered during B9 and local migrations were applied.

The repair plan currently contains no defined B10 implementation task. The text saying `B10+ pending` is stale. The next activity is branch reconciliation and final merge validation, not another Settings feature phase.

## Visual audit result

Desktop and mobile review found no blocking visual defects.

One non-blocking UX improvement remains: the Runtime Integrations error text `Failed to discover runtime integrations` is technically correct for a discovery failure, but can be made friendlier later. Do not replace it with `No local runtimes detected` unless the server can distinguish an empty successful discovery from an actual discovery error.

## Repository state before reconciliation

At the reconciliation check:

- `master`: `c7802231a18cfabfd39f9bcc676651ff4c711c3a`;
- feature branch after acceptance-artifact cleanup: `3358925afa89193f98d6d9b0df37b0dabc28040b`;
- comparison status: **diverged**;
- feature branch: **124 commits ahead** of master;
- feature branch: **4 commits behind** master;
- merge base: `ba182f9aab35d476d70661cbc13bfb58e8ad5df4`.

Do not fast-forward `master` directly to the feature branch. Reconcile the four master-side commits first and rerun validation.

## Pre-merge findings that must be handled

### B9 test credentials

`tests/b9_acceptance.test.ts` currently contains a hard-coded local test email/password. Even if the account is local-only, credentials should not remain embedded in a committed test file.

Before merge:

- move browser-test credentials to environment variables;
- fail clearly when required B9 credentials are absent;
- rotate the local test password if it is reused anywhere else.

Because the value already exists in Git history, removing it from the current file does not erase historical commits.

### B9 test strictness

The initial B9 Playwright file contains several permissive checks that take screenshots or continue when required UI is absent. It also contains a stale expectation that CADAM Original should have no Edit button, while the accepted product behavior is read-only original plus safe Edit-to-create Overlay/Fork.

Before treating the Playwright suite as a permanent regression gate:

- make required UI assertions fail when the UI is absent;
- correct the CADAM Original Edit expectation;
- remove silent conditional passes;
- rerun the hardened suite.

### Playwright reproducibility

`playwright.config.ts` and the B9 test are committed, but `@playwright/test` is not currently declared in `package.json` and no B9 npm script is defined.

Choose one explicit policy before merge:

1. make Playwright a maintained project test dependency with a pinned lockfile update and script; or
2. classify B9 Playwright as a local/manual acceptance artifact and document the exact external invocation used.

Do not leave an ambiguous committed test that only works because a developer happens to have Playwright installed globally.

## Master reconciliation procedure

Use a normal merge of current `master` into `local-dev-continue`; avoid rebasing the large validated feature history unless there is a specific reason to rewrite it.

During conflict resolution:

- preserve current working Settings, OpenCode, Codex, provider and prompt implementations from the feature branch;
- preserve master-side documentation/audit information that is still accurate;
- do not resurrect stale OpenCode assumptions that were superseded by the implemented and validated feature branch;
- do not modify `pcad-builder` merely to resolve documentation conflicts;
- do not weaken authentication, ownership checks, provider routing or no-fallback behavior.

After reconciliation, rerun:

- project typecheck;
- lint;
- production build;
- full automated test suite;
- hardened B9 browser acceptance;
- one final visual check at desktop and approximately 390px.

Only after all checks pass should the feature PR be marked ready for merge into `master`.

## Merge gate

The final merge is allowed only when all of the following are true:

- feature branch contains current master;
- no unresolved conflicts;
- automated validation passes;
- browser acceptance passes after reconciliation;
- no committed browser-test credentials remain in the current tree;
- Playwright maintenance policy is explicit;
- final diff review finds no silent fallback or auth regression;
- status/plan documentation no longer claims undefined `B10+` work remains.
