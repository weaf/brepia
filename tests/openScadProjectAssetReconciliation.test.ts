import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  reconcileOpenScadProjectAssetManifest,
} from '../shared/openScadProjectAssetReconciliation';
import {
  validateOpenScadProjectAssetReferences,
} from '../shared/openScadProjectReferences';
import type {
  OpenScadProject,
  OpenScadProjectAsset,
} from '../shared/openScadProject';

const trustedAsset: OpenScadProjectAsset = {
  path: 'assets/part.stl',
  storagePath: 'user/conversation/part.stl',
  mediaType: 'model/stl',
  byteLength: 123,
  sha256: 'a'.repeat(64),
};

function projectWithImport(
  assets?: OpenScadProjectAsset[],
): OpenScadProject {
  return {
    schemaVersion: 1,
    entrypointPath: 'main.scad',
    files: [
      {
        path: 'main.scad',
        content: 'import("assets/part.stl");',
      },
    ],
    ...(assets ? { assets } : {}),
  };
}

describe('OpenSCAD authoritative asset reconciliation', () => {
  it('restores a referenced trusted asset when an AI snapshot omits the manifest', () => {
    const reconciled = reconcileOpenScadProjectAssetManifest(
      projectWithImport(),
      [trustedAsset],
    );

    assert.deepEqual(reconciled.assets, [trustedAsset]);
    assert.doesNotThrow(() => validateOpenScadProjectAssetReferences(reconciled));
  });

  it('replaces AI-provided metadata with the authoritative descriptor', () => {
    const invented: OpenScadProjectAsset = {
      ...trustedAsset,
      storagePath: 'user/conversation/invented.stl',
      byteLength: 999,
      sha256: 'b'.repeat(64),
    };
    const reconciled = reconcileOpenScadProjectAssetManifest(
      projectWithImport([invented]),
      [trustedAsset],
    );

    assert.deepEqual(reconciled.assets, [trustedAsset]);
  });

  it('drops an invented descriptor that is not authoritative', () => {
    const invented: OpenScadProjectAsset = {
      ...trustedAsset,
      storagePath: 'user/conversation/invented.stl',
      sha256: 'b'.repeat(64),
    };
    const reconciled = reconcileOpenScadProjectAssetManifest(
      projectWithImport([invented]),
      [],
    );

    assert.equal(reconciled.assets, undefined);
    assert.throws(
      () => validateOpenScadProjectAssetReferences(reconciled),
      /does not resolve to a project asset/,
    );
  });

  it('drops trusted assets that the revised project no longer references', () => {
    const reconciled = reconcileOpenScadProjectAssetManifest(
      {
        schemaVersion: 1,
        entrypointPath: 'main.scad',
        files: [{ path: 'main.scad', content: 'cube(10);' }],
        assets: [trustedAsset],
      },
      [trustedAsset],
    );

    assert.equal(reconciled.assets, undefined);
  });
});
