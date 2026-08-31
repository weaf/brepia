# Brepia Compatibility-Safe Customization Skill

## Purpose

Keep Brepia changes narrow and maintainable while preserving compatibility-sensitive CADAM/pCAD lineage that still forms part of the live runtime contract.

The `pcad-upstream-safe-customization` skill name is retained as a technical identifier; it does not mean old pCAD implementation plans are current instructions.

## Before editing

1. Read `AGENTS.md` and `docs/brepia_branding.md`.
2. Inspect the live implementation and current tests for the area being changed.
3. If a historical plan/checkpoint is referenced, reconcile it against current code before deciding anything remains to do.
4. Identify generated files, compatibility identifiers and high-conflict integration points before editing.

## Compatibility boundaries

Do not rename or remove these as incidental cleanup:

- `/cadam` compatibility routing;
- `CADAM Original` prompt/profile lineage;
- `PCAD_*` environment variables;
- compatibility-sensitive `pcad_*` / `pcad.invalid` identifiers;
- existing `pcad-*` integration/tool/script identifiers;
- Sentry `adamcad`;
- `adam-*` design tokens.

Changing one of these requires an explicit migration/deprecation plan appropriate to that identifier.

## Implementation principles

- Prefer the smallest change that fits the current architecture.
- Reuse existing modules and abstractions before adding parallel ones.
- Keep route files thin and reusable server logic in `src/server/` where practical.
- Preserve Parametric, Creative and stable-runtime semantics unless the task explicitly changes them.
- Do not copy stale model catalogs, prompts or provider configuration out of historical documents.
- Do not assume historical symbols still exist; verify current definitions and call sites first.
- Do not hand-edit `src/routeTree.gen.ts` or `shared/database.ts`.
- For schema changes, use the schema-first workflow in `.cursor/rules/database-workflow.mdc`.

## Diff discipline

Before completion:

```bash
git diff --check
git diff --stat
```

Inspect the complete diff for unrelated formatting, accidental refactors, generated-file churn and compatibility-name changes.

Run the relevant repository gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Do not run broad formatting merely to normalize untouched files. Keep formatting changes scoped to the files being changed unless a dedicated formatting task explicitly says otherwise.
