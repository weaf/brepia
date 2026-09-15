import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const progressSource = fs.readFileSync(
  new URL('../src/components/brep/BrepCreationProgress.tsx', import.meta.url),
  'utf8',
);
const projectViewSource = fs.readFileSync(
  new URL('../src/views/BrepProjectView.tsx', import.meta.url),
  'utf8',
);

describe('BRep generation progress UI', () => {
  it('keeps first-generation progress inside the ordinary conversation workspace', () => {
    assert.match(projectViewSource, /const creationWorkspacePending/);
    assert.match(
      projectViewSource,
      /if \(creationWorkspacePending\) {[\s\S]*<ConversationView/,
    );
    assert.match(
      projectViewSource,
      /variant="inline"[\s\S]*<BrepChatSession/,
    );
    assert.match(projectViewSource, /Waiting for native BRep preview/);
    assert.doesNotMatch(
      projectViewSource,
      /if \([\s\S]{0,300}pendingBrepCreation[\s\S]{0,300}return \(\s*<BrepCreationProgress/,
    );
  });

  it('shows the same inline durable status while editing an existing BRep revision', () => {
    assert.match(projectViewSource, /showActiveGenerationProgress/);
    assert.match(
      projectViewSource,
      /showActiveGenerationProgress[\s\S]*mode="edit"/,
    );
    assert.match(projectViewSource, /isGenerationRunTerminal/);
  });

  it('offers verbose persisted server details without inventing hidden retry state', () => {
    assert.match(progressSource, /Generation details/);
    assert.match(progressSource, /Server detail/);
    assert.match(progressSource, /Progress event/);
    assert.match(progressSource, /Request message/);
    assert.match(progressSource, /Response message/);
    assert.match(progressSource, /Last update/);
    assert.match(progressSource, /generationRunModelLabel/);
    assert.doesNotMatch(progressSource, /retry count|attempt count/i);
  });
});
