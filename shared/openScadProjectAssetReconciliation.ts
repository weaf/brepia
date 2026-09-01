import {
  normalizeOpenScadProject,
  type OpenScadProject,
  type OpenScadProjectAsset,
} from './openScadProject.ts';
import { collectOpenScadProjectAssetReferences } from './openScadProjectReferences.ts';

/**
 * Rebuild an AI-edited project's asset manifest from descriptors Brepia already
 * trusts. Agents may keep or drop references to existing assets, but they must
 * never invent storage paths, hashes, sizes, or media types for binary data.
 *
 * Only statically referenced asset paths are retained. Missing/dynamic/invalid
 * references are intentionally left unresolved so the normal reference
 * validator can reject them with the canonical diagnostic.
 */
export function reconcileOpenScadProjectAssetManifest(
  project: OpenScadProject,
  authoritativeAssets: readonly OpenScadProjectAsset[],
): OpenScadProject {
  const normalized = normalizeOpenScadProject(project);
  const references = collectOpenScadProjectAssetReferences(normalized);
  if (references.length === 0) {
    return normalizeOpenScadProject({ ...normalized, assets: undefined });
  }

  const authoritativeByPath = new Map<string, OpenScadProjectAsset>();
  for (const asset of authoritativeAssets) {
    authoritativeByPath.set(asset.path, asset);
  }

  const referencedPaths = new Set(
    references.flatMap((reference) =>
      !reference.dynamic && reference.resolvedPath
        ? [reference.resolvedPath]
        : [],
    ),
  );
  const assets = [...referencedPaths].flatMap((path) => {
    const asset = authoritativeByPath.get(path);
    return asset ? [asset] : [];
  });

  return normalizeOpenScadProject({
    ...normalized,
    assets: assets.length > 0 ? assets : undefined,
  });
}
