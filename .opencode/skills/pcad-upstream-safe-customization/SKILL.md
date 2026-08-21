# pCAD Upstream-Safe Customization Skill

## Purpose

Ensure every local customization task preserves upstream CADAM compatibility and minimizes future conflict surface.

## Must Do (before and during implementation)

1. **Identify upstream-owned files** — List every file the task touches that is upstream-owned (not new local files).
2. **Prefer additive modules** — Create new files under `src/server/` and `src/components/settings/` rather than modifying existing upstream-heavy files.
3. **Keep built-in definitions intact** — Never modify `PARAMETRIC_MODELS` in `src/lib/utils.ts` or `PARAMETRIC_AGENT_PROMPT` in `src/server/aiChat.ts`.
4. **No copy-paste of upstream source** — Do not duplicate upstream model catalogs, prompts, or provider configs into user-owned database tables or new source files.
5. **Record unavoidable upstream edits** — If a task MUST touch an upstream-heavy file, list the exact changes and why in a "sync seam" comment at the top of the file.

## Must Do (before task completion)

6. **Run diff checks:**
   ```bash
   git diff --check
   git diff --stat
   ```
7. **Inspect diff for churn** — Verify there is no unnecessary whitespace, formatting changes to unrelated lines, or accidental refactoring.
8. **Run validation gates:**
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```

## Must NOT Do

- Run formatting over unrelated files (no `prettier --write .` on broad paths).
- Refactor unrelated upstream code while implementing a local feature.
- Rename existing upstream symbols unless the plan explicitly requires it.
- Change existing behavior unless the plan task explicitly describes the new behavior.
- Store upstream model IDs, prompts, or provider configs in database tables.

## Sync Seam Convention

When you MUST edit an upstream-heavy file, add a comment block at the top describing the integration seam:

```typescript
// pCAD LOCAL CUSTOMIZATION — sync seam
// Purpose: [why this upstream file is touched]
// Task: [PxxX from plan]
// Alternative considered: [what additive approach was rejected and why]
// Future conflict risk: [how a future upstream change might conflict]
```
