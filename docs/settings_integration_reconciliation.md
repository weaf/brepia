# Settings integration — completion and master reconciliation

Status: **REPAIR B1-B9 IMPLEMENTED; FINAL B9 ASSERTION HARDENING REQUIRED BEFORE PR REVIEW**

Branch: `local-dev-continue`

Reviewed: 2026-08-18

## Current state

The Models / Prompts / Providers repair work B1-B9 is implemented on `local-dev-continue`, and current `master` has already been reconciled into the feature branch.

Evidence recorded in the branch:

- automated integration/regression suite: 137 tests passing;
- Playwright B9 suite: 22 tests passing in Chromium;
- visual audit completed at 1280x800 and 390px;
- Models, Prompts and Providers passed the visual audit;
- CADAM Original shows the real prompt and remains read-only while Edit creates Overlay/Fork profiles;
- Runtime Integrations are separated from custom providers;
- signed-in Settings flows no longer show Unauthorized failures;
- a missing local `prompt_profiles` migration was discovered during B9 and local migrations were applied.

Completed cleanup:

- B9 credentials moved to environment variables (`B9_EMAIL`, `B9_PASSWORD`);
- CADAM Original Edit expectation corrected to require the safe Edit-to-Overlay/Fork flow;
- `@playwright/test` is a declared dev dependency;
- `npm run test:b9` is the canonical B9 command;
- B9 artifacts are ignored by git;
- typecheck, lint, build, Vitest and the current Playwright suite were reported green after master reconciliation.

## Final independent review findings

The final independent review found that several Playwright tests still pass without proving the behavior named by the test. These are merge blockers because B9 is intended to be a behavior gate, not only a page-presence smoke test.

### Models

- `hide a model in Settings and confirm it disappears from picker` toggles a Settings switch but only checks that generic visibility-count text exists. It must capture the exact model being hidden, open the new-conversation model picker and assert that model is absent.
- `re-enable a hidden model and confirm it returns` still contains a conditional path and only checks generic visibility text. It must assert that the exact model returns to the picker.

### Prompts

- `create an Overlay via Edit button on CADAM Original` still conditionally clicks Overlay only when visible and has no postcondition proving the Overlay editor/profile flow was reached. Overlay must be a required assertion.
- `set a prompt profile as default and verify new conversation pins it` currently only verifies that a CADAM profile entry exists. It must actually set a custom profile as default, create a new conversation and verify that conversation is pinned to the selected profile.
- `changing default does not affect existing conversation prompt profile` currently only verifies that a CADAM profile entry exists. It must actually prove an existing conversation keeps its pinned profile after the default changes.
- Fork creation/prefill should remain explicitly covered by browser acceptance, or be clearly classified as manual vision-only acceptance instead of implied automated coverage.

### Providers

- `OpenCode runtime state displayed correctly` and `Codex runtime state displayed correctly` only assert that the Runtime Integrations section exists; they do not assert the corresponding runtime entry/state.
- `custom provider CRUD — Add provider button visible` only verifies the Add button. Either restore actual create/edit/delete coverage or rename the test and do not claim CRUD browser coverage.
- `test connection endpoint visible` only verifies the Runtime Integrations section and does not exercise or observe the custom-provider Test Connection action/request.

### Documentation

- `docs/settings_integration_repair_plan.md` still says `NEARLY COMPLETE — B9 passed, B10+ pending` and still records `24/24`; this is stale.
- `docs/local_customization_settings_status.md` still reports B8 complete and B9 next; this is stale.

## Security note

The old local B9 password remains present in Git history even though it has been removed from the current tree. If that password is reused anywhere, rotate it. No history rewrite is required for a disposable local-only test credential, but reuse would make rotation necessary.

## Final merge gate

PR #1 may be marked ready only when all of the following are true:

- feature branch contains current master;
- no unresolved conflicts;
- automated validation passes;
- hardened B9 tests prove the behavior named by the required scenarios rather than generic page presence;
- no committed browser-test credentials remain in the current tree;
- Playwright maintenance policy remains explicit and reproducible;
- final diff review finds no silent fallback or auth regression;
- repair/status documentation is current and contains no stale B10+ claim.

Do not merge PR #1 until this gate passes.
