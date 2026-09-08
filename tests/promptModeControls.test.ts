import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const textAreaSource = fs.readFileSync(
  new URL('../src/components/TextAreaChat.tsx', import.meta.url),
  'utf8',
);
const promptViewSource = fs.readFileSync(
  new URL('../src/views/PromptView.tsx', import.meta.url),
  'utf8',
);

describe('home prompt creation mode controls', () => {
  it('shows Parametric and Mesh as explicit top-level choices', () => {
    assert.match(promptViewSource, /aria-label="Creation mode"/);
    assert.match(promptViewSource, /handleTypeChange\('parametric'\)/);
    assert.match(promptViewSource, /handleTypeChange\('creative'\)/);
    assert.match(promptViewSource, />\s*Parametric\s*</);
    assert.match(promptViewSource, />\s*Mesh\s*</);
    assert.doesNotMatch(
      promptViewSource,
      /onTypeChange=\{handleTypeChange\}/,
    );
  });

  it('keeps OpenSCAD and Native BRep as the Parametric source level', () => {
    assert.match(promptViewSource, /Parametric source/);
    assert.match(promptViewSource, /OpenSCAD/);
    assert.match(promptViewSource, /Native BRep/);
    assert.match(promptViewSource, /type === 'parametric'/);
  });

  it('uses one mixed Attach entry point and existing mode-aware validation', () => {
    assert.match(textAreaSource, /aria-label="Attach files"/);
    assert.match(textAreaSource, /input\.multiple = true/);
    assert.match(textAreaSource, /input\.accept = attachmentAccept/);
    assert.match(textAreaSource, /isSupportedMeshFile\(file\.name, type\)/);
    assert.match(textAreaSource, /parametricModelSupportsVision\(model\)/);
    assert.doesNotMatch(textAreaSource, /ImagePlus/);
    assert.doesNotMatch(textAreaSource, /FileUp/);
  });

  it('keeps Native BRep text-only across picker, paste and drag/drop', () => {
    assert.match(
      promptViewSource,
      /attachmentsDisabled=\{[\s\S]*parametricSourceKind === 'brep'/,
    );
    assert.match(
      promptViewSource,
      /attachmentDisabledReason="Native BRep creation is text-only for now\."/,
    );
    assert.match(textAreaSource, /if \(attachmentInteractionsDisabled\) \{/);
    assert.match(textAreaSource, /if \(attachmentsDisabled\) \{/);
    assert.match(textAreaSource, /const handlePaste =/);
    assert.match(textAreaSource, /const handleDrop = async/);
    assert.match(textAreaSource, /await addItems\(droppedFiles\)/);
  });

  it('blocks all attachment ingress while the prompt itself is disabled', () => {
    assert.match(
      textAreaSource,
      /const attachmentInteractionsDisabled = disabled \|\| attachmentsDisabled/,
    );
    assert.match(
      textAreaSource,
      /const addItems = async \(files: FileList\) => \{\s*if \(attachmentInteractionsDisabled\)/,
    );
    assert.match(
      textAreaSource,
      /disabled=\{attachmentInteractionsDisabled\}/,
    );
  });

  it('does not silently carry incompatible Mesh attachments into Parametric', () => {
    assert.match(promptViewSource, /Remove incompatible attachments first/);
    assert.match(promptViewSource, /mesh\.fileType !== 'stl'/);
    assert.match(promptViewSource, /images\.length > 0/);
    assert.match(promptViewSource, /parametricSourceKind === 'brep'/);
  });

  it('reads durable server progress during the first Native BRep generation', () => {
    assert.match(promptViewSource, /useLatestBrepGenerationRun\(\{/);
    assert.match(promptViewSource, /conversationId: draftConversationId/);
    assert.match(promptViewSource, /pollWhenMissing: nativeBrepGenerationActive/);
    assert.match(promptViewSource, /generationRun=\{homeGenerationRun\}/);
  });
});
