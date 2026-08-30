# Brepia Settings UX and appearance plan

Status: **COMPLETE on `feature/post-merge-functionality` — implementation and Phase 6 final verification complete**

This plan covered usability, responsiveness, appearance, and accessibility improvements for the Brepia Settings experience. It remained intentionally separate from Parametric/Creative runtime behavior, AI prompt/profile optimization, Supabase contracts, and stable-runtime recovery.

## Goals — complete

- [x] Preserve the Brepia dark visual identity as the default appearance.
- [x] Make Settings use available desktop/tablet space without making simple account content unnecessarily wide.
- [x] Make Settings predictable and usable on narrow mobile screens without hidden horizontal navigation.
- [x] Add a first-class `System / Light / Dark` application appearance preference.
- [x] Keep the 3D viewer background brightness control independent from application appearance.
- [x] Improve discoverability and reduce technical density without removing advanced controls.
- [x] Improve practical WCAG 2.2 reflow, contrast, focus visibility, reduced motion, and pointer/touch target behavior.
- [x] Preserve existing settings behavior, permissions, AI model/profile semantics, and stable-runtime architecture.

## UX invariants preserved

- No broad Brepia redesign was introduced.
- Parametric, Creative, model routing, prompt/profile, Supabase, authentication, and stable-runtime semantics were not changed as part of Settings UX work.
- Application theme remains independent from the 3D viewer background control.
- Existing admin/debug visibility rules remain unchanged.
- Destructive actions remain separated and confirmed.
- Existing conversation/model/profile pinning semantics remain unchanged.

## Phase 1 — Responsive Settings shell — COMPLETE

Implementation checkpoint: `a708226a649a663b303ac1a46b8514e9a49d3fce`.

- [x] Stable top alignment when switching Settings sections.
- [x] Comfortable Account reading width.
- [x] Wider desktop workspace for AI, Administration, and Debug.
- [x] Full-width mobile behavior with safe side padding.
- [x] No document-level horizontal overflow in final desktop/mobile review.
- [x] Existing Account actions and AI controls render correctly.
- [x] Account and AI headings remain stable when switching tabs.
- [x] Long model names/selects gain useful desktop width.
- [x] Account does not become excessively wide.
- [x] 320–390 px mobile widths remain usable without document-level horizontal scrolling.

## Phase 2 — Responsive Settings navigation — COMPLETE

Implementation checkpoint: `c5abec6c96592a5a031a8c21aec101cfb541b020`.

- [x] Primary Settings navigation wraps instead of depending on hidden horizontal overflow.
- [x] Desktop/tablet AI settings use left-side section navigation.
- [x] Mobile AI settings use an explicit section selector.
- [x] Prompt subsection navigation wraps instead of hiding behind horizontal scrolling.
- [x] Radix keyboard/ARIA semantics are preserved.
- [x] Every Settings and AI section is discoverable at narrow phone widths.
- [x] Desktop AI navigation preserves useful content width.
- [x] Administration/Debug visibility does not make primary navigation unclear.
- [x] Prompt subsection controls remain readable and usable on narrow phones.

## Phase 3 — Application appearance: System / Light / Dark — COMPLETE

Primary implementation checkpoint: `949d605a56c8c9467ba240289b0106c52ca37cb9`.

Additional checkpoints/fixes:

- User-menu appearance quick switcher: `ca8218dadd76a05099c2e59d79a812107487ee19`.
- Shared Sheet close accessibility/contrast: `4f5b28807aae4d0e98ef1413238523ea4cc4b699`.
- Mobile sidebar local white-close override removed: `8a2cb6a332c9512bbab126343ed6e2e4ee7c0c68`.
- Conversation user-text Light-theme regression fixed: `2a8f336e4e44a85c1f8af92bf614a7a41549cbc0`.

Completed outcomes:

- [x] `Appearance` control under Account with `System`, `Light`, and `Dark`.
- [x] `System` follows `prefers-color-scheme` including live OS changes.
- [x] Explicit preference persists through `brepia-appearance`.
- [x] `color-scheme` and browser theme-color track resolved appearance.
- [x] Semantic Brepia surface/text/border tokens support both Light and Dark.
- [x] Main auth, legal, History, Settings, navigation, chat, and shared Sheet surfaces are theme-aware.
- [x] Dark preserves the Brepia baseline.
- [x] Light has no known major dark-only or unreadable application surface after final review.
- [x] Explicit Light/Dark survives reload without a visible wrong-theme flash in final verification.
- [x] System visibly updates with OS appearance changes in final verification.
- [x] Application appearance remains independent from viewer background brightness.
- [x] Mobile sidebar close control remains visible in both themes.

## Phase 4 — Settings information hierarchy — COMPLETE

Implementation checkpoint: `8c2303ce971cb07173d673ee7e8289784bcb95f2`.

- [x] AI opens on `General` with Default models and AI profile immediately visible.
- [x] Expert model controls live under `Model catalog` rather than sharing the common landing surface.
- [x] `Local Models`, `Prompts`, `Runtime`, `Providers`, and `Vision` remain available under the advanced grouping.
- [x] Mobile and desktop navigation expose the same Common/Advanced structure.
- [x] No new simplified mode hides functionality.
- [x] General and advanced sections remain usable at narrow mobile widths.

Reconciliation note: the earlier plan mentioned a separate `Creative controller AI` preference, but the current persisted AI-settings schema has no such independent preference. UX work therefore did not invent one.

## Phase 5 — Accessibility and interaction polish — COMPLETE

### Phase 5A

Interaction checkpoint: `281eb0c05de53b6c201dfc56bf2c1f19f9b11d42`.

- [x] Practical 40 px minimum targets for primary Settings/AI navigation and prompt subsection controls.
- [x] Practical Account action/input targets.
- [x] Notifications switch has an accessible name and description.
- [x] Appearance choices form an explicitly labelled control group with `aria-pressed` state.
- [x] Focus-visible behavior remains clear on shared Radix primitives.
- [x] Reduced-motion handling added to touched transitions.

### Phase 5B

Implementation checkpoint: `9030163aac4e67b29f3c3faf416eb39faa778887`.

- [x] Small tertiary/neutral text contrast raised to practical WCAG targets in both themes.
- [x] Dense mobile buttons, selects, inputs, and switches use practical interaction targets.
- [x] Shared keyboard focus was strengthened, including application links.
- [x] Selected, disabled, and error states retain programmatic/textual meaning rather than color-only signaling.
- [x] Application-level reduced-motion fallback covers nonessential CSS animation/transition duration.
- [x] 200% zoom/reflow and 320–390 px rendering verified during Phase 6.

## Phase 6 — Visual and regression gate — COMPLETE

Final user verification confirms the Settings UX implementation and closeout gate are complete.

### Desktop review

- [x] Account
- [x] AI / General
- [x] AI / Model catalog
- [x] AI / Local Models
- [x] AI / Prompts
- [x] AI / Runtime
- [x] AI / Providers
- [x] AI / Vision
- [x] Administration when available
- [x] Debug when enabled

### Responsive/reflow review

- [x] ~320 px phone
- [x] ~390 px phone
- [x] tablet/narrow desktop
- [x] standard desktop
- [x] wide desktop
- [x] 200% browser zoom/reflow
- [x] no document-level horizontal scrolling in Settings

### Appearance review

- [x] System follows OS appearance changes while Brepia is open.
- [x] Light appearance verified.
- [x] Dark appearance verified.
- [x] Explicit Light/Dark survives reload without visible wrong-theme flash.
- [x] App appearance remains independent from viewer background brightness.
- [x] Mobile sidebar close control is visible in both Light and Dark.
- [x] Conversation text remains readable in both Light and Dark after the final regression fix.

### Interaction/accessibility spot check

- [x] Keyboard through top Settings tabs and desktop AI navigation.
- [x] Keyboard through mobile AI selector, buttons, links, and switches.
- [x] Focus indicator remains visible in both themes.
- [x] Dense Model catalog / Local Models / Providers controls remain practical on phone widths.
- [x] Disabled and error states remain understandable without relying on color alone.

### Repository gate

The final Phase 6 test is user-confirmed complete in the normal project environment:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

No separate CI log is claimed here; this closeout records the user's final verification of the branch gate.

## Final closeout

Settings UX and appearance work is complete. Future changes in this area should be treated as new requirements or concrete regressions rather than continuation of this plan. Do not reopen broad UX redesign or mix future Settings changes with AI/Creative/Parametric/stable-runtime functionality unless a separate plan explicitly requires it.
