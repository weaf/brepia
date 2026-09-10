import { Box, FileUp, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { importBrepProjectConversation } from '@/services/brepProjectService';
import {
  BREP_PROJECT_PACKAGE_MAX_BYTES,
  parseBrepProjectPackageJson,
} from '@shared/brepProjectPackage';
import type { Conversation } from '@shared/types';

function updatedLabel(conversation: Conversation): string {
  const value = conversation.updated_at ?? conversation.created_at;
  if (!value) return 'Saved BRep model';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved BRep model';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function BrepModelLibrary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const { data: models = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ['brep-model-library', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user?.id ?? '')
        .eq('type', 'parametric')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as Conversation[]).filter(
        (conversation) =>
          conversation.settings?.parametricSourceKind === 'brep',
      );
    },
  });

  const importPackage = async (file: File) => {
    if (!user?.id || importing) return;
    setImportError(null);
    if (file.size > BREP_PROJECT_PACKAGE_MAX_BYTES) {
      setImportError(
        `BRep project package exceeds ${BREP_PROJECT_PACKAGE_MAX_BYTES} bytes.`,
      );
      return;
    }

    setImporting(true);
    try {
      const projectPackage = parseBrepProjectPackageJson(await file.text());
      const conversationId = await importBrepProjectConversation({
        userId: user.id,
        projectPackage,
      });
      await navigate({ to: '/brep/$id', params: { id: conversationId } });
    } catch (reason) {
      setImportError(
        reason instanceof Error
          ? reason.message
          : 'Could not import BRep project.',
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="h-full overflow-auto bg-adam-background-1 text-adam-text-primary">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Box className="h-6 w-6 text-adam-blue" />
              <h1 className="text-2xl font-semibold">BRep Models</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-adam-text-tertiary">
              Open a saved native BRep model and continue from its existing
              conversation and immutable revision history. Create brand-new
              models from New Creation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json,.brepia-brep.json"
              className="hidden"
              aria-label="Import saved BRep model"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) void importPackage(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={importing || !user?.id}
              onClick={() => importInputRef.current?.click()}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {importing ? 'Importing…' : 'Import model'}
            </Button>
            <Button type="button" onClick={() => void navigate({ to: '/' })}>
              <Plus className="mr-2 h-4 w-4" />
              New Creation
            </Button>
          </div>
        </div>

        {importError ? (
          <p className="mt-5 rounded-lg border border-destructive p-3 text-sm text-destructive">
            {importError}
          </p>
        ) : null}

        <section className="mt-8" aria-label="Saved BRep models">
          {isLoading ? (
            <div className="rounded-xl border border-adam-neutral-700 bg-adam-bg-secondary-dark p-6 text-sm text-adam-text-tertiary">
              Loading saved BRep models…
            </div>
          ) : models.length === 0 ? (
            <div className="rounded-xl border border-dashed border-adam-neutral-700 bg-adam-bg-secondary-dark/70 p-8 text-center">
              <Box className="mx-auto h-8 w-8 text-adam-neutral-500" />
              <h2 className="mt-3 text-base font-medium">No saved BRep models yet</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-adam-text-tertiary">
                Start a Native BRep creation from the home prompt, or import an
                existing Brepia BRep package. The resulting model will appear
                here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {models.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  onClick={() =>
                    void navigate({
                      to: '/brep/$id',
                      params: { id: conversation.id },
                    })
                  }
                  className="group flex min-h-32 flex-col rounded-xl border border-adam-neutral-700 bg-adam-bg-secondary-dark p-4 text-left transition-colors hover:border-adam-neutral-600 hover:bg-adam-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adam-blue"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <Box className="mt-0.5 h-5 w-5 shrink-0 text-adam-blue" />
                    <span className="text-[10px] uppercase tracking-wide text-adam-neutral-500">
                      Native BRep
                    </span>
                  </div>
                  <span className="mt-4 line-clamp-2 font-medium text-adam-text-primary">
                    {conversation.title || 'Untitled BRep model'}
                  </span>
                  <span className="mt-auto pt-3 text-xs text-adam-text-tertiary">
                    {updatedLabel(conversation)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
