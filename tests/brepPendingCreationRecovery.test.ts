import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const promptViewSource = fs.readFileSync(
  new URL('../src/views/PromptView.tsx', import.meta.url),
  'utf8',
);
const projectRouteSource = fs.readFileSync(
  new URL('../src/views/ProjectRouteView.tsx', import.meta.url),
  'utf8',
);
const progressSource = fs.readFileSync(
  new URL('../src/components/brep/BrepCreationProgress.tsx', import.meta.url),
  'utf8',
);

describe('pending native BRep creation recovery', () => {
  it('shows creation progress while the initial model request is still running', () => {
    assert.match(promptViewSource, /<BrepCreationProgress/);
    assert.match(promptViewSource, /requestSavedOverride=\{brepRequestSaved\}/);
    assert.match(promptViewSource, /setBrepRequestSaved\(true\)/);
    assert.match(progressSource, /requestSavedOverride \?\? messages\.some/);
  });

  it('remembers a pending native BRep across a reload of the home route', () => {
    assert.match(promptViewSource, /PENDING_BREP_SESSION_KEY/);
    assert.match(promptViewSource, /navigation\?\.type !== 'reload'/);
    assert.match(promptViewSource, /window\.location\.replace\(`\/brep\/\$\{pendingConversationId\}`\)/);
  });

  it('routes a pending BRep project from project navigation before its first assistant artifact exists', () => {
    assert.match(projectRouteSource, /current_message_leaf_id, settings/);
    assert.match(
      projectRouteSource,
      /conversation\.settings\?\.parametricSourceKind === 'brep'/,
    );
    assert.match(projectRouteSource, /to: isBrep \? '\/brep\/\$id' : '\/editor\/\$id'/);
  });
});
