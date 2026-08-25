import { useRef } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { Button } from '@/components/ui/button';
import { GithubScadImportButton } from '@/components/GithubScadImportButton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { readScadImportFile } from '@/lib/scadImport';
import { createImportedScadProject } from '@/services/scadProjectImportService';
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
      const result = await createImportedScadProject({
        userId: user.id,
        model,
        executionMode,
        filename: file.name,
        code,
        origin: { source: 'upload' },
      });

      posthog.capture('openscad_imported', {
        conversation_id: result.conversationId,
        filename: file.name,
        source: 'upload',
        compile_status: result.baseline.status,
      });

      return result;
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
    <div className="flex flex-wrap justify-end gap-2">
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
      <GithubScadImportButton
        model={model}
        executionMode={executionMode}
        disabled={disabled || importMutation.isPending}
      />
    </div>
  );
}
