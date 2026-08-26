import { createFileRoute } from '@tanstack/react-router';
import {
  corsHeaders,
  isRecord,
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import {
  STEP_EXPORT_SOURCE_LIMIT_BYTES,
  StepExportError,
  exportScadToStep,
} from '@/server/stepExport';

const STEP_EXPORT_REQUEST_LIMIT_BYTES =
  STEP_EXPORT_SOURCE_LIMIT_BYTES * 3 + 4_096;

class StepExportRequestError extends Error {
  constructor(
    public readonly code: 'request_too_large' | 'invalid_json',
    public readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
    this.name = 'StepExportRequestError';
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > STEP_EXPORT_REQUEST_LIMIT_BYTES
    ) {
      throw new StepExportRequestError(
        'request_too_large',
        413,
        'STEP export request body is too large.',
      );
    }
  }

  if (!request.body) {
    throw new StepExportRequestError(
      'invalid_json',
      400,
      'STEP export request body must be JSON.',
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > STEP_EXPORT_REQUEST_LIMIT_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new StepExportRequestError(
          'request_too_large',
          413,
          'STEP export request body is too large.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new StepExportRequestError(
      'invalid_json',
      400,
      'STEP export request body must be valid UTF-8 JSON.',
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new StepExportRequestError(
      'invalid_json',
      400,
      'STEP export request body must be valid JSON.',
    );
  }
}

function errorResponse(error: unknown) {
  if (error instanceof StepExportRequestError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof StepExportError) {
    const status = error.code === 'provider_unavailable' ? 503 : 400;
    return json({ error: error.message, code: error.code }, status);
  }
  if (isUnauthorizedError(error)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  console.error('[STEP export] Unexpected failure:', error);
  return json({ error: 'step_export_failed' }, 500);
}

export const Route = createFileRoute('/api/export/step')({
  server: {
    handlers: {
      GET: methodNotAllowed,
      OPTIONS: preflight,
      POST: async ({ request }) => {
        try {
          await requireUser(request);
          const body = await readBoundedJson(request);
          if (
            !isRecord(body) ||
            typeof body.sourceCode !== 'string' ||
            !body.sourceCode.trim()
          ) {
            return json({ error: 'invalid_scad_source' }, 400);
          }

          const result = await exportScadToStep(body.sourceCode);
          return new Response(result.bytes, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'model/step',
              'Content-Disposition': 'attachment; filename="model.step"',
              'X-PCAD-Step-Provider': result.provider,
              'X-PCAD-Step-Warning-Count': String(result.warnings.length),
            },
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
