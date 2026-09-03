import { supabase } from '@/lib/supabase';
import type { BrepParameterValues } from '@shared/brepProvider';
import type { BrepProject } from '@shared/brepProject';
import { apiUrl } from './api';

export async function exportBrepStep(
  project: BrepProject,
  parameterValues: BrepParameterValues,
): Promise<Blob> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const response = await fetch(apiUrl('brep/export/step'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ project, parameterValues }),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `BRep STEP export failed (${response.status}).`;
    throw new Error(message);
  }
  return response.blob();
}
