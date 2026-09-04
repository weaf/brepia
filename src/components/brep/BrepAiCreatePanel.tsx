import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DefaultChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { createAndCacheAiChat } from '@/hooks/useCachedAiChat';
import { useParametricModelCatalog } from '@/hooks/useParametricModelCatalog';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/services/api';
import { getAiPreferences } from '@/services/aiPreferencesService';
import { persistUserMessage } from '@/services/messageService';
import {
  UNCONFIGURED_MODEL_ID,
  resolveParametricDefaultModel,
} from '@/lib/defaultModels';
import { conversationTitleFromText } from '@shared/conversationTitle';
import type { AppUIMessage } from '@shared/chatAi';

type BrepCreationMetadata = AppUIMessage['metadata'] & {
  parametricSourceKind: 'brep';
};

export function BrepAiCreatePanel() {
  const { user } = useAuth();
  const { models, isLoading: isCatalogLoading } = useParametricModelCatalog();
  const { data: aiPreferences, isLoading: isPreferencesLoading } = useQuery({
    queryKey: ['ai-preferences', 'defaults'],
    queryFn: getAiPreferences,
    staleTime: 0,
    enabled: Boolean(user),
  });
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const submitInFlightRef = useRef(false);

  const model = useMemo(
    () =>
      resolveParametricDefaultModel(
        aiPreferences?.defaultParametricModelId,
        models,
      ),
    [aiPreferences?.defaultParametricModelId, models],
  );

  const disabled =
    !user?.id ||
    isCatalogLoading ||
    isPreferencesLoading ||
    model === UNCONFIGURED_MODEL_ID ||
    !prompt.trim() ||
    isCreating;

  const createWithAi = async () => {
    if (submitInFlightRef.current || disabled || !user?.id || !aiPreferences) {
      return;
    }

    submitInFlightRef.current = true;
    setIsCreating(true);
    setError(null);

    const conversationId = crypto.randomUUID();
    const text = prompt.trim();
    const title = conversationTitleFromText(text, {
      imageCount: 0,
      meshCount: 0,
    });
    const metadata: BrepCreationMetadata = {
      model,
      parametricSourceKind: 'brep',
    };
    const parts: AppUIMessage['parts'] = [{ type: 'text', text }];

    try {
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .insert([
          {
            id: conversationId,
            user_id: user.id,
            title,
            type: 'parametric',
            settings: {
              model,
              instructionProfileId: aiPreferences.defaultInstructionProfileId,
              openCodeExecutionMode: 'cli',
              promptProfileId: aiPreferences.defaultPromptProfileId ?? null,
              // Product intent is persisted for inspection, while the root
              // user-message metadata below is the branch-scoped routing
              // authority used before the first canonical source exists.
              parametricSourceKind: 'brep',
            },
          },
        ])
        .select()
        .single();
      if (conversationError || !conversation) {
        throw new Error(
          `Failed to create BRep conversation: ${conversationError?.message ?? 'missing row'}`,
        );
      }

      const userMessageId = await persistUserMessage({
        conversationId,
        parts,
        metadata,
        parentMessageId: null,
      });

      const chat = createAndCacheAiChat({
        id: `brep:${conversationId}`,
        generateId: () => crypto.randomUUID(),
        messages: [],
        transport: new DefaultChatTransport<AppUIMessage>({
          api: apiUrl('parametric-chat'),
          headers: async (): Promise<Record<string, string>> => {
            const token = (await supabase.auth.getSession()).data.session
              ?.access_token;
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
          prepareSendMessagesRequest: ({ body }) => ({
            body: {
              conversationId,
              model,
              openCodeExecutionMode: 'cli',
              ...(body ?? {}),
            },
          }),
        }),
        // Native BRep tools execute on the server and are terminal for this
        // initial creation request. Never use the OpenSCAD client-tool loop.
        sendAutomaticallyWhen: () => false,
      });

      await chat.sendMessage({
        id: userMessageId,
        parts,
        metadata,
      });

      window.location.assign(`/brep/${conversationId}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not create a native BRep project with AI.',
      );
      setIsCreating(false);
      submitInFlightRef.current = false;
    }
  };

  return (
    <section className="mx-6 mt-6 rounded-lg border border-adam-neutral-700 bg-adam-bg-secondary-dark p-5 text-adam-text-primary">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Create native BRep with AI</h1>
        <p className="text-sm text-adam-text-tertiary">
          This explicitly creates a canonical native BRep project. The ordinary
          Generative start page remains OpenSCAD by default.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <Textarea
          value={prompt}
          disabled={isCreating}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the native parametric model you want to create…"
          className="min-h-24 flex-1"
        />
        <Button
          className="md:self-end"
          disabled={disabled}
          onClick={() => void createWithAi()}
        >
          {isCreating ? 'Creating native BRep…' : 'Create with AI'}
        </Button>
      </div>

      {model === UNCONFIGURED_MODEL_ID && !isCatalogLoading ? (
        <p className="mt-3 text-sm text-destructive">
          Configure a default Parametric AI model before creating a BRep project.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded border border-destructive p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
