import { useRef } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  boundedScadCompileError,
  isBlockingScadCompileError,
  readScadImportFile,
  scadImportTitle,
} from '@/lib/scadImport';
import { persistImportedArtifact } from '@/services/importedArtifactService';
import { previewScadColoredViaToolWorker } from '@/worker/toolWorker';
import type { ImportedArtifactBaseline } from '@shared/importedArtifact';
import type { Model } from '@shared/types';

export function ScadImportButton({
  model,
  executionMode,
  disabled = false,
}: {
  model: Model;
  executionMode: 'cli' | 'streaming';
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('User must be authenticated');

      const code = await readScadImportFile(file);
      const title = scadImportTitle(file.name);

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
        .eq('user_id', user.id)
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
          user_id: user.id,
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
            source: 'upload',
            filename: file.name,
            importedAt: new Date().toISOString(),
          },
          baseline,
        });
      } catch (error) {
        // Avoid leaving an empty project behind if the authoritative imported
        // message pair did not persist. Conversation/message FK cascade handles
        // any partial rows should the backend ever stop treating the bulk insert
        // atomically.
        try {
          await supabase
            .from('conversations')
            .delete()
            .eq('id', conversationId)
            .eq('user_id', user.id);
        } catch {
          // Preserve the original import failure; cleanup is best-effort.
        }
        throw error;
      }

      posthog.capture('openscad_imported', {
        conversation_id: conversationId,
        filename: file.name,
        compile_status: baseline.status,
      });

      return { conversationId };
    },
    onSuccess: async ({ conversationId }) => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate({ to: '/editor/$id', params: { id: conversationId } });
    },
    onError: (error) => {
      Sentry.captureException(error, { extra: { hook: 'SCAD import' } });
      toast({
        title: 'Could not import OpenSCAD file',
        description:
          error instanceof Error ? error.message : 'The SCAD import failed.',
        variant: 'destructive',
      });
    },
  });

  const chooseFile = () => {
    if (!user?.id) return;
    inputRef.current?.click();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".scad"
        className="hidden"
        disabled={disabled || importMutation.isPending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) importMutation.mutate(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={chooseFile}
        disabled={disabled || importMutation.isPending || !user?.id}
        className="gap-2 border-adam-neutral-700 bg-adam-background-2 text-adam-text-secondary hover:bg-adam-bg-secondary-dark"
      >
        {importMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        {importMutation.isPending ? 'Importing SCAD…' : 'Import SCAD'}
      </Button>
    </>
  );
}
