import { supabase } from '@/lib/supabase';
import { apiUrl } from './api';

export type StepExportResponse = {
  file: Blob;
  provider: string | null;
  warningCount: number;
};

export async function exportStep(sourceCode: string): Promise<StepExportResponse> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const response = await fetch(apiUrl('export/step'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ sourceCode }),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : `STEP export failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  const warningCount = Number(response.headers.get('X-PCAD-Step-Warning-Count') ?? '0');
  return {
    file: await response.blob(),
    provider: response.headers.get('X-PCAD-Step-Provider'),
    warningCount: Number.isFinite(warningCount) ? warningCount : 0,
  };
}
