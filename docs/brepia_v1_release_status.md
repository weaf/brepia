# Brepia v1.0.0 Release Status

## Status

Brepia v1.0.0 is ready for release review and merge to `master`.

Release branch:

- `feature/v1-hardening`

Final hardening baseline before release preparation:

- `3f7d208ef025c319b6339080bc1d68e87d8a9f1f`

The v1.0 release scope is frozen. No new functionality is included as part of the release closeout.

## Release changes

- Package version updated from `0.0.0` to `1.0.0`.
- `package.json` and `package-lock.json` version metadata are synchronized.
- TanStack generated route tree refreshed to include the existing:
  - `/api/conversations/workspace`
  - `/api/settings/adminModels`
- Repository formatting normalized with Prettier as a separate mechanical formatting commit.

## Verification

Manual functional testing of the v1 hardening work is complete.

The final formatted working tree has passed:

- `npx prettier --check .`
- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`

`npm ci` completed with zero reported vulnerabilities.

## Release constraints

Any future functional development should be performed after the v1.0.0 release on a new branch from updated `master`.

## Remaining release steps

1. Commit and push the final release-preparation changes.
2. Open and review the pull request from `feature/v1-hardening` to `master`.
3. Merge when the release review is clean.
4. Tag the merged `master` commit as `v1.0.0`.
5. Publish the GitHub Release for Brepia v1.0.0.
