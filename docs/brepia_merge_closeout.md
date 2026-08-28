# Brepia merge closeout

Date: 2026-08-28  
Branch: `feature/brepia-remake`  
Tested runtime/code HEAD: `568570e724911764115d85d9559b8c42bdadbcae`

## Result

The Brepia remake closeout gate is **GREEN**.

The user ran the final local verification against the branch state at:

`568570e724911764115d85d9559b8c42bdadbcae`

and reported that all requested closeout checks passed.

This document is the authoritative final closeout record and supersedes older unchecked merge-gate wording in the earlier Phase 6/status handovers.

## Final Instance identity smoke

PASS in the real local installation:

- fresh/default Instance identity is neutral and exposes no operator/contact/community/Discord/legal ownership claim;
- administrator save/reload of operator/contact settings works;
- administrator save/reload of Community configuration works;
- administrator save/reload of Discord configuration works;
- administrator save/reload of legal-link configuration works;
- authenticated non-admin update protection passes;
- clearing Discord removes the navigation entry after refresh;
- Community and Discord coexist correctly;
- Community visibility toggle works without requiring deletion of the stored URL;
- legal-link visibility toggle works while the neutral local Terms/Privacy surfaces remain available;
- configured operator/contact presentation does not imply that Brepia/Noty automatically operates every installation.

## Final regression gate

PASS in the real local checkout:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The user reported the entire requested gate as passing/green.

## Final smoke

PASS:

- normal desktop/mobile Brepia presentation;
- Parametric conversation behavior;
- Creative model selection and capability messaging;
- authentication/settings access;
- Instance identity navigation/legal presentation;
- no closeout regression identified.

## CADAM Original

The intentionally-last decision is closed.

`CADAM Original` remains the explicit inherited/pre-Brepia built-in prompt-profile/lineage label. The synthetic `builtin:parametric` ID, inherited system prompt and fingerprint semantics are intentionally preserved. This is historical/compatibility lineage, not an unfinished Brepia presentation defect.

## Optional/non-blocking items

The following do not block this merge:

- removal of the now-dead `lottie-react` dependency/package metadata, which should only be done later through the real npm toolchain with generated lockfile changes;
- repository/deployment rename;
- specialized GIF/GLB/reduced-motion visual exercises that were not otherwise regressed;
- the deferred post-merge Local Creative functionality program.

## Scope after this point

Do not add new functionality to `feature/brepia-remake`.

`docs/post_merge_functionality_plan.md` has not been started. LLaMA-Mesh, `trellis.cpp` and other Local Creative/runtime improvements must begin only on a new branch created from updated `master` after this merge.

## Test SHA versus documentation-only closeout commit

The full runtime/build gate was executed on `568570e724911764115d85d9559b8c42bdadbcae`.

This closeout file is a documentation-only commit created after that green test run. It does not modify runtime code, dependencies, generated database types, generated route trees, migrations or build configuration. Therefore the runtime/code content being merged is the exact content that passed the final gate.

## Merge disposition

The Brepia remake is approved for merge to `master`, subject only to a fresh branch comparison confirming that the feature branch remains based cleanly on current `master`.
