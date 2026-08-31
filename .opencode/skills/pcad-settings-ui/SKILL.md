# Brepia Settings UI Skill

## Purpose

Guide changes to Brepia Settings while preserving the current responsive shell, access boundaries and existing component/service architecture.

## Current structure

`src/views/SettingsView.tsx` owns the Settings page shell and top-level tabs. Feature-specific settings UI is split into components under `src/components/settings/`, including AI, administration, debug and instance/legal sections.

Do not move all settings logic back into `SettingsView.tsx`. Reuse existing section/panel components and service/API helpers.

## Responsive and accessibility rules

- Preserve the existing mobile/desktop Settings shell and its `min-w-0`, wrapping and responsive-width patterns.
- Reuse shadcn/Radix primitives and current Tailwind tokens/classes.
- Preserve keyboard accessibility, labels, focus behavior and dialog semantics.
- Use the existing `adam-*` design tokens; they are compatibility-sensitive and are not cosmetic rename targets.
- Do not introduce a second UI framework or inline-style system for settings work.

Do not impose arbitrary pixel/timing requirements that are not already part of the component being changed. Inspect the current responsive implementation and tests before choosing new dimensions or debounce timings.

## Data and mutations

- Use React Query and existing services/hooks for server state.
- Use current TanStack Query object syntax, for example `invalidateQueries({ queryKey: [...] })`, matching surrounding code.
- Authenticated `/api/...` calls should reuse Brepia's existing API helpers/patterns rather than raw unauthenticated fetches.
- Keep loading, success, empty and failure states explicit.
- Disable or guard repeated mutations while an operation is pending when the existing interaction requires it.
- Do not silently substitute another provider/model/profile when a selected item is unavailable.

## Access boundaries

- Administration UI must remain gated by the current account-access role checks.
- Debug/lifecycle controls must preserve their current environment/runtime visibility rules.
- Client-side hiding is not authorization; server API routes must keep their own authorization checks.

## Secrets

Provider credentials must never be rendered back to the user or written to browser logs.

Use the current provider DTO contract (`hasCredential`) and existing credential update/removal UX. Do not create masked fake secret values that could accidentally be submitted as real credentials unless the existing component explicitly uses that pattern.

## Destructive actions

Use existing confirmation/dialog patterns for destructive actions such as account deletion, provider deletion or profile deletion. The confirmation text should match the actual server-side effect.

## Component placement

- Reusable settings feature panels belong under `src/components/settings/`.
- Shared data access belongs in existing hooks/services/server modules, not embedded into a large page component.
- Keep `SettingsView.tsx` focused on page-level layout, account-level UI and composing feature sections.

## Completion

For Settings changes:

1. inspect desktop and mobile behavior for the affected section;
2. verify access-role and secret-handling boundaries;
3. run focused tests where available;
4. run:

   ```bash
   npm test
   npm run typecheck
   npm run lint
   npm run build
   git diff --check
   ```

5. preserve stable-runtime and Parametric/Creative behavior unless the task explicitly changes them.
