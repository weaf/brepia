# Brepia Settings UX and appearance plan

Status: **ACTIVE on `feature/post-merge-functionality`**

This plan covers usability, responsiveness, appearance, and accessibility improvements for the Brepia Settings experience. It is intentionally separate from Parametric/Creative runtime behavior, AI prompt/profile optimization, and stable-runtime recovery.

## Goals

- Preserve the current Brepia dark visual identity as the default appearance.
- Make Settings use available desktop/tablet space without becoming unnecessarily wide for simple account content.
- Make Settings predictable and usable on narrow mobile screens without hidden horizontal navigation being required for normal use.
- Add a first-class `System / Light / Dark` application appearance preference.
- Keep the 3D viewer background brightness control independent from the application appearance.
- Improve discoverability and reduce technical density for ordinary users without removing advanced controls.
- Meet practical WCAG 2.2 expectations for reflow, contrast, focus visibility, and pointer/touch target size.
- Preserve all existing settings behavior, permissions, AI model/profile semantics, and stable-runtime architecture.

## Baseline observations

The current implementation is functional but has several UX constraints:

- `SettingsView` used a single `max-w-xl` content width for Account, AI, Administration, and Debug. This was reasonable for Account but unnecessarily constrained AI and administration controls on desktop.
- The root Settings flex layout vertically centered short pages, so the page heading moved significantly when switching between a short Account page and a long AI page.
- AI settings already contain responsive grids, but the narrow parent prevented those layouts from making good use of desktop width.
- Top-level Settings and AI subsection navigation used horizontally scrollable tab lists with hidden scrollbars. Phase 2 replaces those hidden-scroll dependencies with wrapping primary tabs, a mobile AI section selector, and desktop side navigation.
- The CSS bundle already contains generic light/dark variables, but most Brepia surfaces still use fixed `adam-*` dark palette utilities, so a real light theme requires semantic application tokens rather than only toggling the existing `.dark` class.
- Secondary text and compact controls should be checked for contrast and mobile target size rather than adjusted by visual guesswork.

## UX invariants

- Do not redesign Brepia broadly or replace the existing visual language.
- Do not change Parametric, Creative, model routing, prompt/profile, Supabase, or stable-runtime behavior as part of this plan.
- Do not couple application theme to the 3D viewer background slider.
- Existing admin/debug visibility rules remain unchanged.
- Destructive actions remain clearly separated and confirmed.
- Existing conversation/model/profile pinning semantics remain unchanged.
- Prefer CSS/layout changes and small reusable UI primitives over page-specific viewport hacks.

## Phase 1 — Responsive Settings shell

Goal: fix the desktop width/top-alignment problem before changing navigation or theme.

Implementation checkpoint: `a708226a649a663b303ac1a46b8514e9a49d3fce`.

- [x] Keep all Settings sections aligned to a stable top position when switching tabs.
- [x] Keep Account content at a comfortable reading width.
- [x] Allow AI, Administration, and Debug content to use a wider desktop workspace (roughly 960–1050 px maximum).
- [x] Keep full-width mobile behavior with safe 16 px side padding.
- [ ] Ensure no new horizontal document overflow is introduced in real desktop/mobile review.
- [ ] Verify existing Account actions and AI controls still render correctly.

Acceptance — pending visual review:

- [ ] Account and AI headings do not jump vertically when switching tabs.
- [ ] Long model names/selects gain useful desktop width.
- [ ] Account does not become excessively wide.
- [ ] 320–390 px mobile widths remain usable without document-level horizontal scrolling.

## Phase 2 — Responsive Settings navigation

Goal: remove dependence on hidden horizontal tab scrolling.

Implementation checkpoint: `c5abec6c96592a5a031a8c21aec101cfb541b020`.

Desktop/tablet:

- [x] Keep the primary `Account / AI / Administration / Debug` navigation compact and obvious. The primary list now wraps instead of relying on hidden horizontal overflow.
- [x] Convert the larger AI subsection set into a left-side section navigation with content to the right at desktop/tablet widths.

Mobile:

- [x] Replace horizontally hidden AI subsection tabs with an explicit `Section` selector.
- [x] Keep the currently selected section visible at all times through the controlled selector value.
- [x] Avoid nested horizontal tab strips for normal navigation. The Prompts subsection tabs now wrap instead of scrolling horizontally.
- [x] Preserve keyboard navigation and accessible labels by retaining Radix tab semantics on desktop and using the existing accessible Select primitive on mobile.

Acceptance — pending visual review:

- [ ] Every Settings and AI section is discoverable at 320 px without horizontal swiping to reveal hidden navigation.
- [ ] Desktop users can move between AI sections without losing useful content width.
- [ ] Primary Settings navigation remains clear when Administration and Debug are both visible.
- [ ] Prompt subsection controls remain readable and usable at narrow phone widths.

## Phase 3 — Application appearance: System / Light / Dark

Goal: add a real application-level appearance preference while preserving current dark mode as the default Brepia look.

- [ ] Add an `Appearance` control under Account with `System`, `Light`, and `Dark` choices.
- [ ] Use `prefers-color-scheme` when `System` is selected.
- [ ] Persist the preference locally without requiring a database migration unless cross-device synchronization is explicitly desired later.
- [ ] Apply `color-scheme` appropriately so native form/browser controls match the selected theme.
- [ ] Introduce semantic Brepia surface/text/border tokens and map the existing dark palette to them first.
- [ ] Add a light palette with equivalent hierarchy and accessible contrast.
- [ ] Migrate shared layout/navigation/settings components before long-tail pages.
- [ ] Keep the 3D viewer background brightness preference independent.

Acceptance:

- Dark appearance remains visually consistent with the current Brepia baseline.
- Light appearance is complete enough that no major application surface remains accidentally dark-only.
- System mode updates when the operating-system preference changes.
- Reloading the app preserves an explicit Light/Dark choice.

## Phase 4 — Settings information hierarchy

Goal: reduce technical density without removing expert functionality.

- [ ] Review the AI landing experience after Phases 1–3 before changing information architecture.
- [ ] Keep common choices immediately accessible: Parametric default, Creative 3D default, Creative controller AI, AI profile.
- [ ] Group model catalog, local models, prompts, runtime, providers, and vision as advanced configuration if usability review still shows excessive density.
- [ ] Do not hide functionality behind an irreversible simplified mode.

This phase is conditional: do not reorganize the AI settings if the responsive layout/navigation changes already solve the usability problem.

## Phase 5 — Accessibility and interaction polish

- [ ] Audit normal and secondary text contrast in both themes.
- [ ] Ensure visible keyboard focus on tabs, selectors, buttons, switches, and links.
- [ ] Check mobile pointer/touch targets; aim for approximately 40–44 px practical targets even where WCAG minimum spacing would technically pass.
- [ ] Verify selected/disabled/error states do not rely on color alone.
- [ ] Check zoom/reflow at 200% and narrow viewport widths.
- [ ] Respect reduced-motion preferences for nonessential UI transitions.

## Phase 6 — Visual and regression gate

Desktop review:

- [ ] Account
- [ ] AI / Models
- [ ] AI / Profiles
- [ ] AI / Local Models
- [ ] AI / Prompts
- [ ] AI / Runtime
- [ ] AI / Providers
- [ ] AI / Vision
- [ ] Administration (admin only)
- [ ] Debug (when enabled)

Responsive review:

- [ ] ~320 px phone
- [ ] ~390 px phone
- [ ] tablet/narrow desktop
- [ ] standard desktop
- [ ] wide desktop

Appearance review:

- [ ] System
- [ ] Light
- [ ] Dark
- [ ] app appearance independent from viewer background brightness

Repository gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Execution rule

Implement one phase or narrowly scoped sub-phase at a time. After each visible UX change, perform desktop and mobile review before broadening the scope. Do not combine theme migration, navigation restructuring, and unrelated application behavior in one large change.
