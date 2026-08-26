import { supabase } from '@/lib/supabase';
import {
  boundedScadCompileError,
  isBlockingScadCompileError,
  scadImportTitle,
} from '@/lib/scadImport';
import { persistImportedArtifact } from '@/services/importedArtifactService';
import { previewScadColoredViaToolWorker } from '@/worker/toolWorker';
import type { ImportedArtifactBaseline } from '@shared/importedArtifact';
import type { ImportedArtifactOrigin } from '@shared/chatAi';
import type { Model } from '@shared/types';

export type CreateImportedScadProjectInput = {
  userId: string;
  model: Model;
  executionMode: 'cli' | 'streaming';
  filename: string;
  code: string;
  origin: Omit<ImportedArtifactOrigin, 'type' | 'filename' | 'importedAt'>;
};

export type CreateImportedScadProjectResult = {
  conversationId: string;
  baseline: ImportedArtifactBaseline;
};

export async function createImportedScadProject({
  userId,
  model,
  executionMode,
  filename,
  code,
  origin,
}: CreateImportedScadProjectInput): Promise<CreateImportedScadProjectResult> {
  const title = scadImportTitle(filename);

  let baseline: ImportedArtifactBaseline;
  try {
    await previewScadColoredViaToolWorker(code);
    baseline = { status: 'success' };
  } catch (error) {
    if (isBlockingScadCompileError(error)) throw error;
    baseline = {
      status: 'error',
      errorText: `Compilation failed:\n${boundedScadCompileError(error)}`,
    };
  }

  const { data: aiPreferences, error: preferencesError } = await supabase
    .from('user_ai_preferences')
    .select('default_prompt_profile_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (preferencesError) {
    throw new Error(
      `Failed to load AI preferences: ${preferencesError.message}`,
    );
  }

  const conversationId = crypto.randomUUID();
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({
      id: conversationId,
      user_id: userId,
      title,
      type: 'parametric',
      settings: {
        model,
        openCodeExecutionMode: executionMode,
        promptProfileId: aiPreferences?.default_prompt_profile_id ?? null,
      },
    })
    .select()
    .single();
  if (conversationError) {
    throw new Error(
      `Failed to create conversation: ${conversationError.message}`,
    );
  }
  if (!conversation) throw new Error('Failed to create conversation');

  try {
    await persistImportedArtifact({
      conversationId,
      artifact: { title, version: 'v1', code },
      origin: {
        type: 'import',
        source: origin.source,
        filename,
        importedAt: new Date().toISOString(),
        ...(origin.canonicalUrl ? { canonicalUrl: origin.canonicalUrl } : {}),
      },
      baseline,
    });
  } catch (error) {
    try {
      await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);
    } catch {
      // Preserve the authoritative persistence failure; cleanup is best-effort.
    }
    throw error;
  }

  return { conversationId, baseline };
}
