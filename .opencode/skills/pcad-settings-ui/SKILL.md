# pCAD Settings UI Skill

## Purpose

Guide implementation of pCAD settings UI components that match the project's visual conventions and accessibility standards.

## Visual Conventions

### Reuse Existing Primitives

- Use existing shadcn/ui components (Button, Input, Select, Card, etc.).
- Match existing Tailwind CSS classes and color palette from `SettingsView.tsx`.
- Follow existing spacing, padding, and border radius conventions.
- Do not introduce new UI libraries or styling frameworks.

### Mobile-Safe Layout

- All settings panels must work on mobile viewports (min-width 320px).
- Use responsive grid/flex layouts.
- Avoid fixed-width elements; use `max-w-*` constraints.
- Touch targets must be at least 44px tall.

### Keyboard Accessibility

- All interactive controls must be keyboard-accessible.
- Focus indicators must match the project's focus style (visible outline).
- Tab order must follow logical visual order.
- Forms must have proper `<label>` associations.

## Component Structure

### Location

- New settings panels go in `src/components/settings/`.
- Each panel is a separate component file (e.g., `AiModelsSettings.tsx`, `PromptProfilesSettings.tsx`, `ProvidersSettings.tsx`).
- `SettingsView.tsx` imports and renders these panels as children — it does NOT embed their internal logic.

### Pattern

```tsx
// src/components/settings/AiModelsSettings.tsx
import { useQuery, useMutation } from '@tanstack/react-query';
// ... imports

export function AiModelsSettings() {
  // Query for model list, user preferences
  // Mutations for hide/show, etc.
  return <div className="space-y-4">{/* Panel content */}</div>;
}
```

## State Management

### React Query

- Use `@tanstack/react-query` for data fetching and caching.
- Invalidate cache after mutations (e.g., `queryClient.invalidateQueries(['ai-models'])`).
- Show loading states during data fetching.
- Show error states with retry options.
- Show empty states when no data exists.

### Form State

- Use controlled components with `useState` for form inputs.
- Debounce search/filter inputs (e.g., 300ms).
- Save buttons should be disabled during mutation.

## Security

### Never Render Secrets

- After saving provider credentials, never render them in the UI.
- Show masked values (`****`) if displaying credential status.
- Never log credential values in console output from browser code.

### Destructive Actions

- Delete/archive actions must have confirmation dialogs.
- Confirmation dialogs must clearly describe what will be deleted.

## Save/Cancel Pattern

1. User makes changes.
2. "Save" button is disabled until there are unsaved changes.
3. On save, show loading state.
4. On success, invalidate cache, show success message (auto-dismiss after 3s).
5. On error, show error message with retry option.
6. "Cancel" reverts to last loaded state.

## Must Do

- Reuse shadcn/ui components for consistency.
- Support mobile viewports.
- Keyboard-accessible controls.
- Clear save/cancel/destructive actions.
- React Query cache invalidation after mutations.
- Loading/error/empty states.
- No secret values rendered after save.
- Separate components for each settings panel.

## Must NOT Do

- Put all AI settings logic inside `SettingsView.tsx`.
- Use inline styles instead of Tailwind classes.
- Introduce new UI libraries.
- Remove existing accessibility attributes.
- Hard-code API endpoint URLs — use existing API route patterns.
- Bypass React Query for data fetching.
- Render credential values in plaintext in the UI.
