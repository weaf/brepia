import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const brepChatSource = fs.readFileSync(
  new URL('../src/components/brep/BrepChatSession.tsx', import.meta.url),
  'utf8',
);
const brepCreateSource = fs.readFileSync(
  new URL('../src/components/brep/BrepAiCreatePanel.tsx', import.meta.url),
  'utf8',
);
const brepEditorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectEditor.tsx', import.meta.url),
  'utf8',
);
const brepIndexSource = fs.readFileSync(
  new URL('../src/routes/_layout/_auth/brep/index.tsx', import.meta.url),
  'utf8',
);
const brepPreviewSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectPreview.tsx', import.meta.url),
  'utf8',
);
const brepProjectServiceSource = fs.readFileSync(
  new URL('../src/services/brepProjectService.ts', import.meta.url),
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

  it('uses the shared Parametric conversation shell on desktop and mobile', () => {
    assert.match(brepViewSource, /<ConversationView/);
    assert.match(
      brepViewSource,
      /previewSlot={<BrepProjectWorkspacePanel \/>}/,
    );
    assert.match(
      brepViewSource,
      /parametersSlot={<BrepProjectParametersPanel \/>}/,
    );
    assert.match(
      brepViewSource,
      /mobilePreviewSlot={<BrepProjectWorkspacePanel isMobile \/>}/,
    );
    assert.match(
      brepViewSource,
      /mobileParametersSlot={<BrepProjectParametersPanel \/>}/,
    );
    assert.match(brepViewSource, /<BrepFeatureWorkspaceProvider>/);
    assert.match(brepViewSource, /setMobilePreviewVersion/);
    assert.match(brepViewSource, /\bWorkspace\b/);
  });

  it('matches the responsive Parametric sidebar hierarchy and exposes canonical BRep JSON', () => {
    assert.match(brepEditorSource, /Project files/);
    assert.match(brepEditorSource, /1 canonical source file/);
    assert.match(brepEditorSource, /project\.brep\.json/);
    assert.match(
      brepEditorSource,
      /Canonical BRep source for the active immutable revision/,
    );
    assert.match(brepEditorSource, /useIsMobile/);
    assert.match(brepEditorSource, /useState\(!isMobile\)/);
    assert.match(brepEditorSource, /setOpen\(!isMobile\)/);
    assert.match(brepEditorSource, /BRep project files/);
    assert.match(
      brepEditorSource,
      /<ScrollArea className="flex-1 px-4 py-4 lg:px-6 lg:py-6">/,
    );
    assert.match(brepEditorSource, /<BrepProjectFilesPanel \/>/);
    assert.match(brepEditorSource, /select BRep download format/);
    assert.match(brepEditorSource, /\.STEP/);
    assert.match(brepEditorSource, /\.BREP JSON/);
  });

  it('uses the shared parametric endpoint without client-side BRep tool execution', () => {
    assert.match(brepChatSource, /apiUrl\('parametric-chat'\)/);
    assert.match(brepChatSource, /sendAutomaticallyWhen:\s*\(\) => false/);
    assert.doesNotMatch(brepChatSource, /addToolOutput/);
    assert.doesNotMatch(brepChatSource, /previewScadColoredViaToolWorker/);
    assert.doesNotMatch(brepChatSource, /build_parametric_model/);
  });

  it('isolates native BRep chat state from the OpenSCAD editor cache and guards duplicate submits', () => {
    assert.match(
      brepChatSource,
      /const chatCacheId = `brep:\$\{conversation\.id\}`/,
    );
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

  it('keeps immutable lifecycle-only BRep revisions out of the visible AI chat branch', () => {
    assert.match(brepViewSource, /isLifecycleOnlyBrepRevision/);
    assert.match(
      brepViewSource,
      /\.filter\(\(node\) => !isLifecycleOnlyBrepRevision\(node\)\)/,
    );
    assert.match(
      brepViewSource,
      /message\.parts\[0\]\?\.type === 'data-brep-project'/,
    );
  });

  it('serializes rapid native evaluation and persists parameters only through explicit save', () => {
    assert.match(brepPreviewSource, /BREP_EVALUATION_DEBOUNCE_MS/);
    assert.match(brepPreviewSource, /browserBrepEvaluationQueue/);
    assert.match(
      brepPreviewSource,
      /version !== evaluationVersionRef\.current/,
    );
    assert.match(brepPreviewSource, /parameterValuesEqual/);
    assert.match(brepPreviewSource, /committedValuesRef/);
    assert.match(brepPreviewSource, /hasUnsavedParameterChanges/);
    assert.match(brepPreviewSource, /Save parameter revision/);
    assert.match(
      brepPreviewSource,
      /Preview values are not yet saved as a source revision\./,
    );
    assert.doesNotMatch(brepPreviewSource, /onBlur=/);

    assert.match(brepEditorSource, /browserBrepEditorEvaluationQueue/);
    assert.match(brepEditorSource, /sourceRevisionRef/);
    assert.match(brepEditorSource, /Save parameter revision/);
    assert.match(
      brepEditorSource,
      /Parameter changes update the native preview immediately/,
    );
  });

  it('keeps revision history compact and safely removable without deleting lineage nodes', () => {
    assert.match(brepEditorSource, /Revision history/);
    assert.match(brepEditorSource, /max-h-\[220px\]/);
    assert.match(brepEditorSource, /\.\.\.revisions\]\.reverse\(\)/);
    assert.match(brepEditorSource, /Delete revision/);
    assert.match(brepEditorSource, /active \|\| !!revisionActionId/);
    assert.match(brepViewSource, /hiddenBrepRevisionIds/);
    assert.match(brepViewSource, /removeBrepProjectRevisionFromHistory/);
    assert.match(brepProjectServiceSource, /brepHiddenRevisionIds/);
    assert.match(
      brepProjectServiceSource,
      /not a physical message DELETE/,
    );
    assert.doesNotMatch(
      brepProjectServiceSource,
      /from\('messages'\)\s*\.delete\(/,
    );
  });

  it('keeps OpenSCAD-only mesh assets out of native BRep follow-up turns', () => {
    assert.match(brepChatSource, /part\.type === 'data-mesh-context'/);
    assert.match(brepChatSource, /STL attachments are OpenSCAD-only/);
  });

  it('exposes explicit AI BRep creation without changing the ordinary Generative start page', () => {
    assert.match(brepIndexSource, /<BrepAiCreatePanel \/>/);
    assert.match(brepCreateSource, /type:\s*'parametric'/);
    assert.match(brepCreateSource, /parametricSourceKind:\s*'brep'/);
    assert.match(brepCreateSource, /id:\s*`brep:\$\{conversationId\}`/);
    assert.match(brepCreateSource, /apiUrl\('parametric-chat'\)/);
    assert.match(brepCreateSource, /sendAutomaticallyWhen:\s*\(\) => false/);
    assert.match(brepCreateSource, /submitInFlightRef/);
    assert.doesNotMatch(brepCreateSource, /build_parametric_model/);
  });
});