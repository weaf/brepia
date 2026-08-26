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
import { exportScadToStep, StepExportError } from '@/server/stepExport';

function errorResponse(error: unknown) {
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
          const body = await request.json().catch(() => null);
          if (!isRecord(body) || typeof body.sourceCode !== 'string' || !body.sourceCode.trim()) {
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
