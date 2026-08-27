import type { AiPreferencesDto } from '@shared/aiSettings';
import { apiJson } from '@/services/api';

export type DefaultModelPreferencesUpdate = {
  defaultParametricModelId?: string | null;
  defaultCreativeModelId?: string | null;
};

export async function getAiPreferences(): Promise<AiPreferencesDto> {
  return (await apiJson('ai-settings/preferences')) as AiPreferencesDto;
}

export async function updateDefaultModelPreferences(
  update: DefaultModelPreferencesUpdate,
): Promise<AiPreferencesDto> {
  return (await apiJson('ai-settings/preferences', {
    method: 'PUT',
    body: JSON.stringify(update),
  })) as AiPreferencesDto;
}
