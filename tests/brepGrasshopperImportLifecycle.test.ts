import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import { createBrepProjectArtifact } from '../shared/brepProjectArtifact.ts';
import type { BrepProject } from '../shared/brepProject.ts';
import { buildBrepGrasshopperImportedArtifact } from '../src/services/brepGrasshopperImportPersistence.ts';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as { source: BrepProject };

const persistenceSource = fs.readFileSync(
  new URL(
    '../src/services/brepGrasshopperImportPersistence.ts',
    import.meta.url,
  ),
  'utf8',
);
const importButtonSource = fs.readFileSync(
  new URL(
    '../src/components/brep/BrepGrasshopperImportButton.tsx',
    import.meta.url,
  ),
  'utf8',
);
const workspaceSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectWorkspacePanel.tsx', import.meta.url),
  'utf8',
);
const triggerSource = fs.readFileSync(
  new URL('../supabase/schemas/triggers.sql', import.meta.url),
  'utf8',
);

describe('BRep Phase 8G GHX lifecycle integration', () => {
  it('builds a normalized immutable BRep artifact from validated GHX parameter state', () => {
    const artifact = createBrepProjectArtifact({
      title: 'Cabinet A42',
      version: 'v1',
      source: { kind: 'brep', source: fixture.source },
    });

    const imported = buildBrepGrasshopperImportedArtifact(artifact, {
      height: 2200,
      width: 1500,
    });

    assert.equal(imported.source.source.id, fixture.source.id);
    assert.deepEqual(
      Object.fromEntries(
        imported.source.source.parameters.map((parameter) => [
          parameter.id,
          parameter.default,
        ]),
      ),
      { height: 2200, width: 1500 },
    );
  });

  it('persists the validated import as an immutable branch revision while preserving the effective active leaf', () => {
    assert.match(triggerSource, /update_leaf_trigger/);
    assert.match(
      triggerSource,
      /current_message_leaf_id\s*=\s*new\.id/,
    );
    assert.match(persistenceSource, /supabase\.from\('messages'\)\.insert/);
    assert.match(persistenceSource, /parent_message_id: parentMessageId/);
    assert.match(persistenceSource, /metadata: \{\}/);
    assert.match(persistenceSource, /activeLeafId: string/);
    assert.match(persistenceSource, /from\('conversations'\)/);
    assert.match(
      persistenceSource,
      /update\(\{ current_message_leaf_id: activeLeafId \}\)/,
    );
    assert.match(
      persistenceSource,
      /eq\('current_message_leaf_id', messageId\)/,
    );
  });

  it('exposes bounded strict GHX import in the active BRep workspace and disables it for historical preview', () => {
    assert.match(
      workspaceSource,
      /<BrepGrasshopperImportButton disabled=\{readOnly\} \/>/,
    );
    assert.match(importButtonSource, /accept="\.ghx,application\/xml,text\/xml"/);
    assert.match(importButtonSource, /if \(disabled \|\| !activeSource/);
    assert.match(importButtonSource, /importBrepGrasshopperGhxFile\(/);
    assert.match(importButtonSource, /changedParameterIds\.length === 0/);
    assert.match(importButtonSource, /persistBrepGrasshopperImportedRevision\(/);
    assert.match(importButtonSource, /activeLeafId: leafId/);
    assert.match(importButtonSource, /Revision history/);
    assert.match(importButtonSource, /queryKey: \['messages', conversation\.id\]/);
    assert.match(importButtonSource, /queryKey: \['conversations'\]/);
  });
});