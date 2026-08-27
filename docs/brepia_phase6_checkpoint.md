# Brepia Phase 6 checkpoint

Updated: 2026-08-27

This is the current execution checkpoint for `feature/brepia-remake`. Read it together with:

- `AGENTS.md`
- `docs/brepia_remake_plan.md`
- `docs/brepia_remake_status.md`
- `docs/brepia_branding.md`

## Branch state

The branch remains a linear descendant of master base:

`967f744976d3ae2fb64f3681745c8c046345499a`

At the start of the current visual/functional review pass, GitHub reports:

- HEAD: `91ef0a7c875c5daa5348cf7e72f0b2b01a86beaa`
- 140 commits ahead of `master`
- 0 commits behind `master`

## Local environment convention

The local Supabase stack is managed by **NOx**.

Do not start/stop Supabase with a global CLI or with `npx supabase start/stop` on this workstation. Once NOx has started the stack, use the repository-local CLI for operations such as:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

Follow `.cursor/rules/database-workflow.mdc`: declarative schema first, generated migration second, never `db push`/`db pull`, and never hand-edit `shared/database.ts`.

## Phase 6 technical gate — GREEN

The technical Phase 6 gate has now been completed in the real local development environment.

Verified:

- Instance identity migration applied.
- Discord social-link migration applied.
- `shared/database.ts` regenerated from the running local Supabase instance.
- `src/routeTree.gen.ts` regenerated through the TanStack/Vite toolchain.
- Generated database typing cleanup included.
- `npm test` PASS.
- `npm run typecheck` PASS.
- `npm run lint` PASS.
- `npm run build` PASS.

The current visual/functional review must therefore avoid unrelated implementation churn. If a review finding requires code changes, rerun the normal gate before calling Phase 6 complete.

## Discord social link

Discord is an administrator-configurable deployment social link, not a hardcoded CADAM-owned invite.

Current behavior:

- `discordUrl` is optional and defaults to `null`.
- no Discord link is shown on a fresh installation;
- admin configures the URL under Instance identity -> Social links;
- only HTTP/HTTPS URLs are accepted;
- the sidebar uses the Discord brand icon;
- desktop and mobile share the same sidebar rendering;
- the old hardcoded invite URL was not restored;
- the generic Community link remains separate for forum/Matrix/other communities.

## Static Instance identity review — no blocking finding

The current code review confirms the intended architecture before the live functional pass:

- public `GET /api/settings/instanceIdentity` returns only the explicit public presentation DTO;
- `PUT` requires an authenticated user and `requireAdmin`, which also requires an active admin account;
- fresh-install server/client defaults contain no operator, contact, community, Discord or legal-service ownership claim;
- public URLs are normalized and restricted to HTTP/HTTPS;
- `showCommunityLink` cannot become publicly effective without a configured community URL;
- Discord remains hidden when `discordUrl` is null;
- the admin Instance identity section is only rendered for an admin account;
- sidebar, legal surfaces and admin settings use the same `['instance-identity']` React Query cache key, so a successful save invalidates/refetches the public identity state;
- mobile navigation reuses the expanded desktop sidebar renderer, so Community/Discord behavior is shared rather than implemented twice;
- Community and Discord are independent and can coexist in the navigation;
- legal links are only exposed as external links when `legalPagesEnabled` is true and the corresponding URL exists.

### Non-blocking hardening observation

`InstanceLegalNotice` currently distinguishes loading from loaded state but not load-error from an unconfigured instance. A failed public Instance identity request can therefore visually fall back to the neutral “no document published” presentation.

Do **not** change this solely from static review during the visual gate. Treat it as a separate hardening item unless the real runtime review shows that it produces a user-visible regression or misleading state that should be fixed now.

## Remaining functional Instance identity review

Verify in the real running application/database:

1. Fresh/default GET is neutral when no singleton configuration has been saved.
2. Admin can save and reload:
   - operator;
   - contact email;
   - Community label + URL + visibility;
   - Discord URL;
   - legal-link toggle;
   - Terms URL;
   - Privacy URL.
3. A non-admin authenticated user receives a forbidden response when attempting `PUT`.
4. Clearing Discord removes it from navigation after the identity query refreshes.
5. Community and Discord can be visible at the same time.
6. Turning off Community hides the Community navigation entry without requiring the stored URL to be deleted.
7. Turning off legal links hides external legal links while the neutral Brepia legal-information pages remain available.
8. Terms/Privacy pages show configured operator/contact information accurately and never imply that Brepia/Noty is automatically the deployment operator.

## Remaining visual desktop/mobile review

This gate must be performed against the real running application. Static code review alone is not sufficient.

### Desktop

Review at a normal desktop viewport with the sidebar both expanded and collapsed:

- Brepia mark geometry and centering;
- `BREPIA` wordmark spacing/tracking;
- collapsed mark size relative to other sidebar icons;
- GitHub, Discord and Community icon/label alignment;
- Community + Discord coexistence without crowding;
- user menu and Settings entry after the additional social rows;
- Instance identity settings card hierarchy and spacing;
- auth/sign-in/sign-up/password surfaces;
- Terms/Privacy neutral notice surfaces;
- activity/loading states used by real application workflows;
- GIF watermark;
- GLB Brepia point-cloud transition.

### Mobile

Review the mobile sheet independently rather than assuming desktop correctness:

- menu trigger placement;
- sheet width and vertical overflow;
- Brepia brand lockup at the top of the sheet;
- social rows with both Discord and Community configured;
- user menu access at the bottom of the sheet;
- Settings page at narrow width, especially Instance identity fields/switches;
- auth/password layouts;
- loading/activity indicators in compact layouts;
- no horizontal overflow or clipped controls.

### Theme / mark behavior

Where supported by the current application:

- inspect normal dark presentation;
- inspect any supported light presentation;
- verify `BrepiaMark tone="mono"` remains legible where monochrome is used;
- verify reduced-motion activity behavior if the environment allows it.

Only make small geometry/spacing/accent corrections discovered by the real review. Do not use Phase 6 as a reason for unrelated UI redesign.

## After the visual gate

1. If review changes app code, rerun:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

2. Perform npm-generated cleanup of dead `lottie-react` and package metadata only after the visual gate, with the lockfile regenerated by npm.
3. Resolve the built-in prompt-profile `CADAM Original` display/lineage strategy **last**.
4. Repository/deployment renames remain a separate later decision.

## Important constraints

- Do not mark the visual gate complete based only on static code review.
- Do not rename compatibility-sensitive `PCAD_*`, `/cadam`, storage/database/local-state identifiers or external integration IDs merely for presentation cleanup.
- Do not touch `CADAM Original` until the Brepia regression, functional Instance identity and visual gates are complete.
