import { supabase } from '@/lib/supabase';
import {
  normalizeOpenScadProject,
  normalizeOpenScadProjectPath,
  type OpenScadProject,
  type OpenScadProjectAsset,
} from '@shared/openScadProject';
import { validateOpenScadProjectAssetReferences } from '@shared/openScadProjectReferences';

const OPENSCAD_ASSET_BUCKET = 'meshes';

export type OpenScadProjectAssetScope = {
  userId: string;
  conversationId: string;
};

export type OpenScadProjectAssetWriter = (
  path: string,
  blob: Blob,
) => Promise<void>;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
}

export function openScadProjectAssetStoragePrefix(
  scope: OpenScadProjectAssetScope,
): string {
  const userId = normalizeOpenScadProjectPath(scope.userId);
  const conversationId = normalizeOpenScadProjectPath(scope.conversationId);
  return `${userId}/${conversationId}/`;
}

export function assertOpenScadProjectAssetStorageScope(
  asset: OpenScadProjectAsset,
  scope: OpenScadProjectAssetScope,
): void {
  const prefix = openScadProjectAssetStoragePrefix(scope);
  if (!asset.storagePath.startsWith(prefix)) {
    throw new Error(
      `OpenSCAD project asset storage is outside the active conversation: ${asset.path}`,
    );
  }
}

export async function hydrateOpenScadProjectAssets(
  project: OpenScadProject,
  scope: OpenScadProjectAssetScope,
  writeAsset: OpenScadProjectAssetWriter,
): Promise<void> {
  const normalizedProject = normalizeOpenScadProject(project);
  if (!normalizedProject.assets?.length) return;

  validateOpenScadProjectAssetReferences(normalizedProject);

  for (const asset of normalizedProject.assets) {
    assertOpenScadProjectAssetStorageScope(asset, scope);

    const { data, error } = await supabase.storage
      .from(OPENSCAD_ASSET_BUCKET)
      .download(asset.storagePath);
    if (error || !data) {
      throw new Error(
        `Could not load OpenSCAD project asset ${asset.path}: ${error?.message ?? 'missing object'}`,
      );
    }
    if (data.size !== asset.byteLength) {
      throw new Error(
        `OpenSCAD project asset size mismatch for ${asset.path}.`,
      );
    }

    const digest = await sha256Blob(data);
    if (digest !== asset.sha256) {
      throw new Error(
        `OpenSCAD project asset checksum mismatch for ${asset.path}.`,
      );
    }

    await writeAsset(asset.path, data);
  }
}
