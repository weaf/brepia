import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const progressSource = fs.readFileSync(
  new URL('../src/components/brep/BrepCreationProgress.tsx', import.meta.url),
  'utf8',
);

describe('BRep durable telemetry UI', () => {
  it('keeps the inline card compact while surfacing the latest durable activity', () => {
    assert.match(progressSource, /useGenerationRunEvents/);
    assert.match(progressSource, /Latest activity:/);
    assert.match(progressSource, /<details[\s\S]*Generation details/);
  });

  it('renders ordered durable activity inside the existing expandable generation details', () => {
    assert.match(
      progressSource,
      /Generation details[\s\S]*Agent activity[\s\S]*Durable generation activity/,
    );
    assert.match(progressSource, /generationEvents\.map/);
    assert.match(progressSource, /generationRunEventLabel\(event\)/);
    assert.match(progressSource, /#\{event\.sequence\}/);
  });

  it('keeps legacy runs useful when detailed telemetry does not exist', () => {
    assert.match(progressSource, /Older runs remain fully supported/);
    assert.match(progressSource, /no detailed agent telemetry/i);
  });
});
