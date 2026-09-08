import type { Database } from '@shared/database';
import {
  isGenerationRunTerminal,
  type GenerationRunExecutionMode,
  type GenerationRunKind,
  type GenerationRunSnapshot,
  type GenerationRunStatus,
  type GenerationRunTransportKind,
} from '@shared/generationRun';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type GenerationRunRow = Database['public']['Tables']['generation_runs']['Row'];

const GENERATION_RUN_POLL_MS = 1_000;

export function generationRunRowToClientSnapshot(
  row: GenerationRunRow,
): GenerationRunSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    requestMessageId: row.request_message_id,
    ...(row.response_message_id
      ? { responseMessageId: row.response_message_id }
      : {}),
    kind: row.kind as GenerationRunKind,
    requestedModelId: row.requested_model_id,
    ...(row.actual_model_id ? { actualModelId: row.actual_model_id } : {}),
    ...(row.transport_kind
      ? { transportKind: row.transport_kind as GenerationRunTransportKind }
      : {}),
    ...(row.execution_mode
      ? { executionMode: row.execution_mode as GenerationRunExecutionMode }
      : {}),
    status: row.status as GenerationRunStatus,
    phase: row.phase as GenerationRunSnapshot['phase'],
    ...(row.detail ? { detail: row.detail } : {}),
    sequence: row.sequence,
    createdAt: row.created_at,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    updatedAt: row.updated_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
  };
}

export function shouldPollGenerationRun(
  run: GenerationRunSnapshot | undefined,
  pollWhenMissing: boolean,
): boolean {
  if (!run) return pollWhenMissing;
  return !isGenerationRunTerminal(run.status);
}

export function useLatestBrepGenerationRun({
  conversationId,
  enabled = true,
  pollWhenMissing = false,
}: {
  conversationId: string;
  enabled?: boolean;
  pollWhenMissing?: boolean;
}) {
  return useQuery<GenerationRunSnapshot | undefined>({
    queryKey: ['generation-run', 'brep', conversationId],
    enabled: enabled && Boolean(conversationId),
    refetchOnWindowFocus: 'always',
    refetchIntervalInBackground: true,
    refetchInterval: (query) =>
      shouldPollGenerationRun(query.state.data, pollWhenMissing)
        ? GENERATION_RUN_POLL_MS
        : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generation_runs')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('kind', 'brep')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data
        ? generationRunRowToClientSnapshot(data as GenerationRunRow)
        : undefined;
    },
  });
}
