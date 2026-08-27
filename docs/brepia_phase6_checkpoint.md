# Brepia Phase 6 checkpoint

Updated: 2026-08-27

This is the current execution checkpoint for `feature/brepia-remake`. Read it together with:

- `docs/brepia_remake_plan.md`
- `docs/brepia_remake_status.md`
- `docs/brepia_branding.md`

## Branch state

The branch remains a linear descendant of master base:

`967f744976d3ae2fb64f3681745c8c046345499a`

At the latest checkpoint it was 136 commits ahead of master and 0 behind before the two follow-up cleanup commits described below.

## Local environment convention

The local Supabase stack is managed by **NOx**.

Do not start/stop Supabase with a global CLI or with `npx supabase start/stop` on this workstation. Once NOx has started the stack, use the repository-local CLI for operations such as:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

Follow `.cursor/rules/database-workflow.mdc`: declarative schema first, generated migration second, never `db push`/`db pull`, and never hand-edit `shared/database.ts`.

## Completed real-environment work

The following has been completed locally and pushed:

- Instance identity migration applied.
- `shared/database.ts` regenerated from the local Supabase instance.
- TanStack `src/routeTree.gen.ts` regenerated.
- The normal project gate was reported green for the first Instance identity pass:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Generated migration `20260827070000_add_instance_discord_link.sql` applied locally.
- Supabase types regenerated again with the Discord column.
- Discord migration/types committed and pushed in `9b49e70e31095d2197aae73d75de5cd5dfa40e42`.

## Discord social link

Discord has been restored as an administrator-configurable deployment social link rather than a hardcoded CADAM-owned invite.

Current behavior:

- `discordUrl` is optional and defaults to `null`.
- no Discord link is shown on a fresh installation;
- admin configures the URL under Instance identity -> Social links;
- only HTTP/HTTPS URLs are accepted;
- the sidebar uses the Discord brand icon;
- desktop and mobile share the same sidebar rendering;
- the old hardcoded invite URL was not restored;
- the generic Community link remains separate for forum/Matrix/other communities.

## Generated database typing cleanup

After the real type regeneration, the temporary local `InstanceSettingsDatabase` adapter was no longer necessary.

Commit `730d1188d6c7e310de45d576912d97aad69f5219` changes `src/server/instanceIdentity.ts` to use the generated `Database['public']['Tables']['instance_settings']['Row']` type and the normal typed service-role Supabase client directly.

This cleanup must be included in the next local regression gate before claiming final Phase 6 PASS.

## UI polish after Discord

Commit `40c15bde975adf87d8d6d9c49cb35836c288d266` removes implementation-history wording from the user-visible Discord helper text. The UI now simply describes it as an optional Discord server/invite URL.

## Current next steps

1. Pull the two latest follow-up commits (`730d118...` and `40c15bd...`).
2. Rerun:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

3. Perform real functional Instance identity checks:
   - fresh/default GET is neutral;
   - admin PUT persists operator/contact/community/Discord/legal fields;
   - non-admin PUT is rejected;
   - clearing Discord removes it from navigation;
   - community and Discord can coexist.
4. Perform visual desktop/mobile review:
   - expanded/collapsed desktop sidebar;
   - mobile sheet;
   - Brepia mark/wordmark spacing;
   - Instance identity settings;
   - Community + Discord links;
   - auth surfaces;
   - light/dark/monochrome where supported;
   - activity/loading states;
   - GIF watermark;
   - GLB Brepia point-cloud transition.
5. Only after the visual gate, perform npm-generated cleanup of dead `lottie-react` and package metadata if desired.
6. Resolve `CADAM Original` prompt-profile display/lineage **last**.
7. Repository/deployment renames remain a separate later decision.

## Important constraint

Do not mark the visual gate complete based only on static code review. The real running application must be visually reviewed on desktop and mobile.
