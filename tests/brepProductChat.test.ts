import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const brepChatSource = fs.readFileSync(
  new URL('../src/components/brep/BrepChatSession.tsx', import.meta.url),
  'utf8',
);
const brepViewSource = fs.readFileSync(
  new URL('../src/views/BrepProjectView.tsx', import.meta.url),
  'utf8',
);

describe('BRep product chat client boundary', () => {
  it('mounts the BRep-specific chat from the persisted native project view', () => {
    assert.match(brepViewSource, /<BrepChatSession/);
    assert.match(brepViewSource, /resolveActiveBrepAiSourceForLeaf/);
    assert.match(brepViewSource, /persistBrepProjectParameterRevision/);
  });

  it('uses the shared parametric endpoint without client-side BRep tool execution', () => {
    assert.match(brepChatSource, /apiUrl\('parametric-chat'\)/);
    assert.match(brepChatSource, /sendAutomaticallyWhen:\s*\(\) => false/);
    assert.doesNotMatch(brepChatSource, /addToolOutput/);
    assert.doesNotMatch(brepChatSource, /previewScadColoredViaToolWorker/);
    assert.doesNotMatch(brepChatSource, /build_parametric_model/);
  });

  it('isolates native BRep chat state from the OpenSCAD editor cache and guards duplicate submits', () => {
    assert.match(brepChatSource, /const chatCacheId = `brep:\$\{conversation\.id\}`/);
    assert.match(brepChatSource, /id:\s*chatCacheId/);
    assert.match(brepChatSource, /const submitInFlightRef = useRef\(false\)/);
    assert.match(brepChatSource, /if \(submitInFlightRef\.current\) return/);
    assert.match(brepChatSource, /submitInFlightRef\.current = true/);
    assert.match(brepChatSource, /submitInFlightRef\.current = false/);
  });

  it('keeps persisted BRep leaf authority server-side while message caches synchronize', () => {
    assert.match(brepViewSource, /leafPresentInMessages/);
    assert.match(brepViewSource, /Synchronizing BRep conversation/);
    assert.doesNotMatch(
      brepViewSource,
      /current_message_leaf_id:\s*userMessageId/,
    );
    assert.doesNotMatch(
      brepViewSource,
      /current_message_leaf_id:\s*newUserMessageId/,
    );
    assert.doesNotMatch(
      brepChatSource,
      /current_message_leaf_id:\s*message\.id/,
    );
  });

  it('keeps OpenSCAD-only mesh assets out of native BRep follow-up turns', () => {
    assert.match(brepChatSource, /part\.type === 'data-mesh-context'/);
    assert.match(brepChatSource, /STL attachments are OpenSCAD-only/);
  });
});
