# Brepia branding maintenance

This note defines the current presentation and naming rules for the Brepia product identity.

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

The mark should remain legible in monochrome. The current blue/violet treatment is a working accent direction rather than a requirement for every context.

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

Use the existing Lucide outline icon language for normal product actions. Brepia branding should not introduce a parallel icon library.

Avoid generic AI identity marks such as robot heads, brains, gears or sparkle clusters. A sparkle or wand icon may still describe a specific AI action.

## Naming boundaries

Current user-facing product presentation and safe local implementation artifacts should use Brepia naming.

The following names remain compatibility-sensitive and require an explicit migration before they are changed:

- the `/cadam` legacy redirect; `/` is the canonical application base;
- `PCAD_*` environment identifiers;
- compatibility-sensitive `pcad_*` and `pcad.invalid` auth/database identifiers;
- external integration identifiers such as the Sentry `adamcad` project;
- the active `CADAM Original` built-in prompt/profile lineage;
- internal `adam-*` Tailwind/CSS compatibility tokens.

Do not recreate removed transition/checkpoint documentation merely to preserve old naming history. Git history is the archive for completed migration work.

## Public assets

Preferred current assets:

- `public/brepia-mark.svg`
- `public/brepia-watermark.svg`
- `public/site.webmanifest`

New user-facing assets should use Brepia naming unless a compatibility requirement says otherwise.

## Copy

Start-page prompt copy lives in `src/lib/homePromptCopy.ts`. Keep it product-neutral where possible and avoid wording that implies a particular generation mode unless that mode is actually active.

## Repository and deployment names

The product is Brepia while the repository remains `weaf/pCAD` for now.

The canonical application base is `/`. The `/cadam` and `/cadam/...` routes exist only as compatibility redirects.

Repository renaming, `PCAD_*` deprecation, auth/database identifier migration, design-token migration and external integration renames must be handled as explicit compatibility changes rather than cosmetic edits.
