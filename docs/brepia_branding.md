# Brepia branding maintenance

This note defines the current presentation rules for the Brepia product identity.
It complements `docs/brepia_remake_plan.md` and `docs/cadam_cleanup_plan.md` and is intentionally short enough to
serve as a maintenance reference for future contributors and coding agents.

## Product hierarchy

- **Brepia** is the product name.
- **Noty** is the creator / umbrella brand.
- Prefer the lockup **`BREPIA` + `by Noty`** on marketing, auth and About-style surfaces.
- Inside dense application chrome, prefer Brepia alone so the modelling workspace remains quiet.

## Primary mark

Use the open node-based wireframe / B-Rep cube implemented by:

- `src/components/brand/BrepiaMark.tsx`
- `public/brepia-mark.svg`

Do not recreate the mark ad hoc in feature components. Reuse the shared component or asset.

The mark should remain legible in monochrome. The current blue/violet treatment is a working
accent direction rather than a requirement for every context.

## Wordmark

Use `src/components/brand/BrepiaBrand.tsx` for symbol + wordmark presentation.
Avoid embedding product-name images in React views when the shared component can be used.

## Activity states

Use `src/components/brand/ActivityIndicator.tsx` for simple indeterminate work states.

Prefer descriptive text when the operation is known, for example:

- `Rendering…`
- `Importing…`
- `Exporting STEP…`

Do not replace meaningful determinate progress bars or percentages with an indeterminate pulse.

## Icons

Use the existing Lucide outline icon language for normal product actions. Brepia branding should
not introduce a parallel icon library.

Avoid generic AI identity marks such as robot heads, brains, gears or sparkle clusters. A sparkle
or wand icon may still describe a specific AI action.

## Naming boundaries

Do not globally replace every occurrence of `CADAM`, `Adam` or `pCAD`.

Rename current user-facing product presentation and safe local implementation artifacts to Brepia, but preserve or separately migrate:

- compatibility-sensitive `PCAD_*` environment identifiers;
- `pcad.invalid` synthetic auth addresses until their database/auth compatibility is explicitly migrated;
- database/storage/local-state identifiers when renaming would require migration;
- external integration IDs such as Sentry project names;
- `CADAM Original` prompt/profile lineage;
- historical/upstream documentation and URLs where the old name is part of the record.

Internal CSS tokens such as `adam-*` are implementation details. They may be renamed later as a dedicated mechanical cleanup only if the repository-wide replacement can be proven behavior-neutral.

The active staged cleanup and classification rules live in `docs/cadam_cleanup_plan.md`.

## Public assets

Preferred current assets:

- `public/brepia-mark.svg`
- `public/brepia-watermark.svg`
- `public/site.webmanifest`

Legacy Adam/CADAM assets may remain temporarily while old consumers or historical README material
still reference them. Delete them only after repository-wide reference verification.

## Copy

Start-page prompt copy lives in `src/lib/homePromptCopy.ts`. Keep it distinct from inherited CADAM
copy and avoid wording that implies a particular generation mode unless that mode is actually active.

## Repository and deployment names

The product is Brepia while the repository remains `weaf/pCAD` for now.

The application no longer requires the inherited `/cadam` deployment base. Its canonical application base is `/`; `/cadam` and `/cadam/...` are retained only as compatibility redirects during the cleanup period.

Repository renaming, `PCAD_*` environment-variable deprecation, Supabase project identity and external integration renames are separate migration checkpoints and must not be bundled into cosmetic changes.
