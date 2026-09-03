import { createFileRoute } from '@tanstack/react-router';
import {
  corsHeaders,
  isRecord,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import {
  brepEvaluationErrorResponse,
  readBoundedBrepJson,
} from '@/routes/api/brep/evaluate';
import { exportBrepProjectToStep } from '@/server/brepEvaluation';
import { normalizeBrepEvaluationRequest } from '@shared/brepProvider';

export const Route = createFileRoute('/api/brep/export/step')({
  server: {
    handlers: {
      GET: methodNotAllowed,
      OPTIONS: preflight,
      POST: async ({ request }) => {
        try {
          await requireUser(request);
          const body = await readBoundedBrepJson(request);
          if (!isRecord(body))
            return Response.json(
              {
                code: 'invalid_brep_request',
                error: 'BRep request must be an object.',
              },
              { status: 400, headers: corsHeaders },
            );
          const normalized = normalizeBrepEvaluationRequest(body);
          const stepBytes = await exportBrepProjectToStep(
            normalized.project,
            normalized.parameterValues,
            request.signal,
          );
          const responseBytes = new Uint8Array(stepBytes.byteLength);
          responseBytes.set(stepBytes);
          return new Response(responseBytes.buffer, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'private, no-store',
              'Content-Type': 'model/step',
              'Content-Disposition': 'attachment; filename="brepia-model.step"',
              'X-Content-Type-Options': 'nosniff',
              'X-PCAD-Step-Provider': 'build123d-occt',
            },
          });
        } catch (error) {
          return brepEvaluationErrorResponse(error);
        }
      },
    },
  },
});
