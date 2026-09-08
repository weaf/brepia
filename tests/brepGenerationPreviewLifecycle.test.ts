import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';
import {
  BrepGenerationPreviewError,
  isRetryableBrepPreviewErrorCode,
  nextBrepPreviewClaimPhase,
  normalizeBrepGenerationPreviewContext,
} from '../src/server/brepGenerationPreviewLifecycle';

const evaluateRouteSource = fs.readFileSync(
  new URL('../src/routes/api/brep/evaluate.ts', import.meta.url),
  'utf8',
);
const editorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectEditor.tsx', import.meta.url),
  'utf8',
);
const projectViewSource = fs.readFileSync(
  new URL('../src/views/BrepProjectView.tsx', import.meta.url),
  'utf8',
);

describe('durable BRep generation preview lifecycle', () => {
  it('normalizes only explicit UUID generation context', () => {
    assert.equal(normalizeBrepGenerationPreviewContext(undefined), undefined);
    assert.deepEqual(
      normalizeBrepGenerationPreviewContext({
        conversationId: '00000000-0000-4000-8000-000000000001',
        revisionMessageId: '00000000-0000-4000-8000-000000000002',
      }),
      {
        conversationId: '00000000-0000-4000-8000-000000000001',
        revisionMessageId: '00000000-0000-4000-8000-000000000002',
      },
    );
    assert.throws(
      () =>
        normalizeBrepGenerationPreviewContext({
          conversationId: 'not-a-uuid',
          revisionMessageId: '00000000-0000-4000-8000-000000000002',
        }),
      (error) =>
        error instanceof BrepGenerationPreviewError &&
        error.code === 'invalid_generation_context' &&
        error.httpStatus === 400,
    );
  });

  it('never regresses phase when retrying an interrupted native preview', () => {
    assert.equal(nextBrepPreviewClaimPhase('revision_saved'), 'evaluation_requested');
    assert.equal(nextBrepPreviewClaimPhase('evaluation_requested'), 'evaluation_requested');
    assert.equal(nextBrepPreviewClaimPhase('evaluating_native'), 'evaluating_native');
  });

  it('keeps transient native-runtime failures retryable', () => {
    for (const code of [
      'provider_unavailable',
      'capacity_exceeded',
      'evaluation_timeout',
      'evaluation_cancelled',
    ]) {
      assert.equal(isRetryableBrepPreviewErrorCode(code), true, code);
    }
    assert.equal(isRetryableBrepPreviewErrorCode('evaluation_failed'), false);
    assert.equal(isRetryableBrepPreviewErrorCode('output_invalid'), false);
  });

  it('wires the active immutable revision into the authenticated preview request', () => {
    assert.match(projectViewSource, /conversationId=\{conversation\.id\}/);
    assert.match(editorSource, /generationContext:/);
    assert.match(editorSource, /revisionMessageId: activeRevisionId/);
    assert.match(
      editorSource,
      /\[activeRevisionId, conversationId, evaluationNonce, project, values\]/,
    );
  });

  it('lets the server own native preview transitions and retryable cancellation', () => {
    assert.match(
      evaluateRouteSource,
      /BrepGenerationPreviewLifecycle\.begin\(/,
    );
    assert.match(evaluateRouteSource, /previewLifecycle\?\.preparingViewer\(\)/);
    assert.match(evaluateRouteSource, /previewLifecycle\?\.completed\(\)/);
    assert.match(evaluateRouteSource, /lifecycle\.retryable\(error\.code\)/);
    assert.match(evaluateRouteSource, /lifecycle\.failed\(/);
  });
});
