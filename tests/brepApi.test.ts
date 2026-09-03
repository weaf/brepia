import { describe, expect, it } from 'vitest';
import {
  BREP_EVALUATION_REQUEST_LIMIT_BYTES,
  brepEvaluationErrorResponse,
  readBoundedBrepJson,
} from '@/routes/api/brep/evaluate';
import { BrepEvaluationError } from '@/server/brepEvaluation';

describe('BRep evaluation API boundary', () => {
  it('keeps a bounded request envelope before any native execution', () => {
    expect(BREP_EVALUATION_REQUEST_LIMIT_BYTES).toBeGreaterThan(0);
    expect(BREP_EVALUATION_REQUEST_LIMIT_BYTES).toBeLessThanOrEqual(
      1024 * 1024,
    );
  });

  it('parses a valid bounded JSON body', async () => {
    const request = new Request('http://localhost/api/brep/evaluate', {
      method: 'POST',
      body: JSON.stringify({ project: { id: 'example' } }),
    });
    await expect(readBoundedBrepJson(request)).resolves.toEqual({
      project: { id: 'example' },
    });
  });

  it('rejects malformed JSON before evaluation', async () => {
    const request = new Request('http://localhost/api/brep/evaluate', {
      method: 'POST',
      body: '{',
    });
    await expect(readBoundedBrepJson(request)).rejects.toBeInstanceOf(
      SyntaxError,
    );
  });

  it('rejects a declared oversized body before reading it', async () => {
    const request = new Request('http://localhost/api/brep/evaluate', {
      method: 'POST',
      headers: {
        'content-length': String(BREP_EVALUATION_REQUEST_LIMIT_BYTES + 1),
      },
      body: '{}',
    });
    await expect(readBoundedBrepJson(request)).rejects.toBeInstanceOf(
      RangeError,
    );
  });

  it('rejects a streamed body that exceeds the limit even without content-length', async () => {
    const request = new Request('http://localhost/api/brep/evaluate', {
      method: 'POST',
      body: 'x'.repeat(BREP_EVALUATION_REQUEST_LIMIT_BYTES + 1),
    });
    await expect(readBoundedBrepJson(request)).rejects.toBeInstanceOf(
      RangeError,
    );
  });

  it('maps capacity, cancellation and provider failures to stable HTTP statuses', async () => {
    const capacity = brepEvaluationErrorResponse(
      new BrepEvaluationError('capacity_exceeded', 'busy'),
    );
    const cancelled = brepEvaluationErrorResponse(
      new BrepEvaluationError('evaluation_cancelled', 'cancelled'),
    );
    const unavailable = brepEvaluationErrorResponse(
      new BrepEvaluationError('provider_unavailable', 'unavailable'),
    );

    expect(capacity.status).toBe(429);
    expect(cancelled.status).toBe(408);
    expect(unavailable.status).toBe(503);
    await expect(cancelled.json()).resolves.toMatchObject({
      code: 'evaluation_cancelled',
    });
  });
});
