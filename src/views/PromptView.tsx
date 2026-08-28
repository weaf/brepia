import { useNavigate, Link } from '@tanstack/react-router';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, ssoProvider } from '@/lib/supabase';
import { signInWithSsoProvider } from '@/lib/ssoAuth';
import TextAreaChat from '@/components/TextAreaChat';
import { ScadImportButton } from '@/components/ScadImportButton';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Model } from '@shared/types';
import { conversationTitleFromText } from '@shared/conversationTitle';
import { MessageItem } from '../types/misc.ts';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { SelectedItemsContext } from '@/contexts/SelectedItemsContext';
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
import { useProfile } from '@/services/profileService';
import { useLayoutContext } from '@/contexts/LayoutContext';
import { apiUrl } from '@/services/api';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import { createAndCacheAiChat } from '@/hooks/useCachedAiChat';
import type { AppUIMessage } from '@shared/chatAi';
import { ensureInputRecords } from '@/lib/aiMessages';
import { persistUserMessage } from '@/services/messageService';
import { HOME_PROMPT_DRAFT_KEY } from '@/lib/promptDraft';
import { pickHomePromptMessage } from '@/lib/homePromptCopy';
import { getRegistrationSettings } from '@/services/accountAdminService';
import { useParametricModelCatalog } from '@/hooks/useParametricModelCatalog';
import { getAiPreferences } from '@/services/aiPreferencesService';
import {
  FALLBACK_PARAMETRIC_MODEL_ID,
  resolveCreativeDefaultModel,
  resolveParametricDefaultModel,
} from '@/lib/defaultModels';

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message
  ) {
    return error.message;
  }
  return fallback;
}

export function PromptView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const { isSidebarOpen } = useLayoutContext();
  const queryClient = useQueryClient();
  const { data: registration } = useQuery({
    queryKey: ['registration-settings'],
    queryFn: getRegistrationSettings,
    staleTime: 30_000,
    enabled: !user && !ssoProvider,
  });
  const {
    models: parametricModels,
    isLoading: isParametricCatalogLoading,
  } = useParametricModelCatalog();
  const { data: aiPreferences } = useQuery({
    queryKey: ['ai-preferences', 'defaults'],
    queryFn: getAiPreferences,
    staleTime: 0,
    enabled: Boolean(user),
  });

  const signupAvailable =
    Boolean(ssoProvider) ||
    registration?.bootstrapAvailable === true ||
    registration?.allowRegistration === true;
  const signupLabel = registration?.bootstrapAvailable
    ? 'Create Administrator'
    : 'Sign Up';

  const firstName = useMemo(() => {
    // Wait until the profile query resolves for signed-in users so the
    // greeting doesn't flash the email local-part before snapping to the
    // real first name.
    if (user && isProfileLoading) return '';
    const source = profile?.full_name || user?.email?.split('@')[0] || '';
    return source.trim().split(/\s+/)[0] || '';
  }, [profile?.full_name, user, isProfileLoading]);

  const [type, setType] = useState<'parametric' | 'creative'>('parametric');

  const parametricDefaultModel = useMemo(
    () =>
      resolveParametricDefaultModel(
        aiPreferences?.defaultParametricModelId,
        parametricModels,
      ),
    [aiPreferences?.defaultParametricModelId, parametricModels],
  );
  const creativeDefaultModel = useMemo(
    () => resolveCreativeDefaultModel(aiPreferences?.defaultCreativeModelId),
    [aiPreferences?.defaultCreativeModelId],
  );

  const [model, setModel] = useState<Model>(FALLBACK_PARAMETRIC_MODEL_ID);
  const initialDefaultAppliedRef = useRef(false);

  useEffect(() => {
    if (
      !user ||
      !aiPreferences ||
      isParametricCatalogLoading ||
      initialDefaultAppliedRef.current
    ) {
      return;
    }

    setModel(
      type === 'creative' ? creativeDefaultModel : parametricDefaultModel,
    );
    initialDefaultAppliedRef.current = true;
  }, [
    aiPreferences,
    creativeDefaultModel,
    isParametricCatalogLoading,
    parametricDefaultModel,
    type,
    user,
  ]);

  // I09B — draft execution mode: owned locally so the transport selector
  // is interactive. Persisted into new conversation settings (I09C done).
  // Does NOT alter the chat request body (I09D).
  const [executionMode, setExecutionMode] = useState<'cli' | 'streaming'>(
    'cli',
  );

  const handleTypeChange = (newType: 'parametric' | 'creative') => {
    setType(newType);
    setModel(
      newType === 'creative' ? creativeDefaultModel : parametricDefaultModel,
    );
  };

  const [isLoaded, setIsLoaded] = useState(false);
  const isMobile = useIsMobile();
  const [images, setImages] = useState<MessageItem[]>([]);
  const [mesh, setMesh] = useState<MessageItem | null>(null);

  const [draftConversationId, setDraftConversationId] = useState(() =>
    crypto.randomUUID(),
  );
  const [homePrompt] = useState(() => pickHomePromptMessage());

  // Trigger fade in on mount
  useEffect(() => {
    // Use requestAnimationFrame to ensure the initial render is complete
    const frame = requestAnimationFrame(() => {
      setIsLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Helper function to get time-based greeting (memoized for performance)
  const getTimeBasedGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    } else if (hour < 18) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  }, []); // Empty dependency array means it only calculates once per page load

  // In SSO mode the provider redirect IS the sign-in: the existing signed-out
  // affordances below fire it directly instead of navigating to the native
  // auth routes (which bounce back to root in this mode). Same UI, same
  // pixels — only where the click goes changes.
  const { mutate: signInWithSso } = useMutation({
    mutationFn: () => signInWithSsoProvider('/'),
    onError: (error) => {
      toast({
        title: 'Whoopsies',
        description: mutationErrorMessage(error, 'Something went wrong'),
        variant: 'destructive',
      });
    },
  });

  const { mutate: handleGenerate, isPending: isGenerating } = useMutation({
    mutationFn: async (parts: AppUIMessage['parts']) => {
      if (!user?.id) throw new Error('User must be authenticated');
      const conversationId = draftConversationId;

      const text = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('');
      const imageCount = parts.filter(
        (p) => p.type === 'file' && p.mediaType.startsWith('image/'),
      ).length;
      const meshCount = parts.filter(
        (p) => p.type === 'data-mesh-context',
      ).length;
      const initialTitle = conversationTitleFromText(text, {
        imageCount,
        meshCount,
      });

      posthog.capture('new_conversation', {
        type: type,
        model_name: model,
        text: text.trim().slice(0, 100),
        image_count: imageCount,
        mesh_count: meshCount,
        conversation_id: conversationId,
      });

      // P04F: pin the user's current default prompt profile on creation.
      // This is a normal user-owned preference read, so use the already
      // authenticated browser Supabase client and let RLS enforce ownership.
      // A missing preferences row is the documented default: CADAM Original.
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
      const promptProfileId = aiPreferences?.default_prompt_profile_id ?? null;

      const createConversation = (title: string) =>
        supabase
          .from('conversations')
          .insert([
            {
              id: conversationId,
              user_id: user.id,
              title,
              type: type,
              settings: {
                model: model,
                openCodeExecutionMode: executionMode,
                promptProfileId,
              },
            },
          ])
          .select()
          .single();

      // Prefer the deterministic local title, but naming is metadata and must
      // never be able to block the primary prompt flow. If a live database has
      // an unexpected title-side constraint, retry the known-good legacy
      // insert once with "New Conversation" and refine the title afterwards.
      let conversationResult = await createConversation(initialTitle);
      if (conversationResult.error && initialTitle !== 'New Conversation') {
        console.warn(
          '[conversation-title] initial titled insert failed; retrying with legacy title',
          conversationResult.error,
        );
        conversationResult = await createConversation('New Conversation');
      }

      const { data: conversation, error: conversationError } =
        conversationResult;
      if (conversationError) {
        throw new Error(
          `Failed to create conversation: ${conversationError.message}`,
        );
      }
      if (!conversation) throw new Error('Failed to create conversation');

      await ensureInputRecords({
        parts,
        conversationId: conversation.id,
        userId: user.id,
      });
      if (parts.length === 0) throw new Error('No message parts to send');

      // Persist the user message before kicking off the chat. The
      // `update_leaf_trigger` on `public.messages` advances the
      // conversation's `current_message_leaf_id` to this row, which is
      // what the server-side chat handler walks to build the model
      // branch — so the row has to land first.
      const userMessageId = await persistUserMessage({
        conversationId: conversation.id,
        parts,
        metadata: { model },
        parentMessageId: null,
      });

      const chat = createAndCacheAiChat({
        id: conversation.id,
        generateId: () => crypto.randomUUID(),
        messages: [],
        transport: new DefaultChatTransport<AppUIMessage>({
          api: apiUrl(
            type === 'creative' ? 'creative-chat' : 'parametric-chat',
          ),
          headers: async (): Promise<Record<string, string>> => {
            const accessToken = (await supabase.auth.getSession()).data.session
              ?.access_token;
            const headers: Record<string, string> = {};
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
            return headers;
          },
          prepareSendMessagesRequest: ({ body }) => ({
            body: {
              conversationId: conversation.id,
              model,
              openCodeExecutionMode: executionMode,
              ...(body ?? {}),
            },
          }),
        }),
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      });
      void chat
        .sendMessage({ id: userMessageId, parts, metadata: { model } })
        .catch((error) => {
          Sentry.captureException(error, {
            extra: {
              hook: 'PromptView initial chat',
              conversationId: conversation.id,
            },
          });
        });

      // Title refinement is deliberately best-effort and non-blocking. Local
      // installs keep the deterministic title when no hosted provider
      // credential exists; if the insert had to use the legacy title, first
      // restore the deterministic title here, then let the endpoint improve it.
      void (async () => {
        try {
          if (conversation.title !== initialTitle) {
            const { error: localTitleError } = await supabase
              .from('conversations')
              .update({ title: initialTitle })
              .eq('id', conversation.id)
              .eq('user_id', user.id);
            if (localTitleError) throw localTitleError;
            await queryClient.invalidateQueries({
              queryKey: ['conversations'],
            });
          }

          const accessToken = (await supabase.auth.getSession()).data.session
            ?.access_token;
          const response = await fetch(apiUrl('title-generator'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : {}),
            },
            body: JSON.stringify({ text, imageCount, meshCount }),
          });
          if (!response.ok) return;

          const result: unknown = await response.json();
          if (
            typeof result !== 'object' ||
            result === null ||
            !('title' in result) ||
            typeof result.title !== 'string' ||
            !result.title.trim() ||
            result.title === initialTitle
          ) {
            return;
          }

          const { error: titleUpdateError } = await supabase
            .from('conversations')
            .update({ title: result.title })
            .eq('id', conversation.id)
            .eq('user_id', user.id);
          if (titleUpdateError) throw titleUpdateError;
          await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        } catch (error) {
          Sentry.captureException(error, {
            extra: {
              hook: 'PromptView conversation title',
              conversationId: conversation.id,
            },
          });
        }
      })();

      return {
        conversationId: conversation.id,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate({ to: '/editor/$id', params: { id: data.conversationId } });
    },
    onError: (error) => {
      setDraftConversationId(crypto.randomUUID());
      Sentry.captureException(error);
      toast({
        title: 'Error',
        description: mutationErrorMessage(error, 'Failed to process prompt'),
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className={cn(
        'relative h-full min-h-full w-full transition-all duration-300 ease-in-out',
        isSidebarOpen && !isMobile && user?.id && 'pb-6 pr-6 pt-6',
      )}
    >
      <div
        className={cn(
          'h-full min-h-full bg-adam-bg-secondary-dark',
          isSidebarOpen &&
            !isMobile &&
            user?.id &&
            'rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)]',
        )}
      >
        {!user && (
          <div className="fixed right-4 top-4 z-10 flex flex-row gap-2">
            {signupAvailable && (
              <Button
                variant="light"
                onClick={() =>
                  ssoProvider ? signInWithSso() : navigate({ to: '/signup' })
                }
                className="w-auto"
              >
                {signupLabel}
              </Button>
            )}
            <Button
              onClick={() =>
                ssoProvider ? signInWithSso() : navigate({ to: '/signin' })
              }
              className="w-auto"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </div>
        )}

        <main className="relative flex h-full w-full flex-col items-center justify-center px-4 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-center">
            <h1
              className={cn(
                'mb-8 text-center text-2xl font-medium text-adam-text-primary md:text-3xl lg:text-4xl',
                'motion-safe:transition-opacity motion-safe:duration-1000 motion-safe:ease-out',
                isLoaded ? 'opacity-100' : 'opacity-0',
              )}
            >
              {getTimeBasedGreeting}
              {firstName ? `, ${firstName}` : ''}!
            </h1>
          </div>
          <div className="flex w-full flex-col items-center">
            <div className="w-full max-w-3xl space-y-4 pb-12">
              <SelectedItemsContext.Provider
                value={{ images, setImages, mesh, setMesh }}
              >
                <TextAreaChat
                  onSubmit={handleGenerate}
                  conversation={{
                    id: draftConversationId,
                    user_id: user?.id ?? '',
                  }}
                  onFocus={() => {
                    if (!user) {
                      if (ssoProvider) {
                        signInWithSso();
                        return;
                      }
                      navigate({ to: '/signin' });
                      return;
                    }
                  }}
                  placeholder={homePrompt}
                  type={type}
                  disabled={isGenerating}
                  model={model}
                  setModel={setModel}
                  showFullLabels={true}
                  onTypeChange={handleTypeChange}
                  executionMode={executionMode}
                  onExecutionModeChange={setExecutionMode}
                  draftStorageKey={HOME_PROMPT_DRAFT_KEY}
                />
              </SelectedItemsContext.Provider>
              {user && type === 'parametric' && (
                <div className="flex justify-end">
                  <ScadImportButton
                    model={model}
                    executionMode={executionMode}
                    disabled={isGenerating}
                  />
                </div>
              )}
              {!user && (
                <p className="text-center text-sm text-gray-500">
                  <Link
                    to="/signin"
                    onClick={(e) => {
                      if (ssoProvider) {
                        e.preventDefault();
                        signInWithSso();
                      }
                    }}
                    className="!text-adam-blue hover:!text-adam-blue/80"
                  >
                    Sign in
                  </Link>{' '}
                  {signupAvailable ? (
                    <>
                      or{' '}
                      <Link
                        to="/signup"
                        onClick={(e) => {
                          if (ssoProvider) {
                            e.preventDefault();
                            signInWithSso();
                          }
                        }}
                        className="!text-adam-blue hover:!text-adam-blue/80"
                      >
                        {registration?.bootstrapAvailable
                          ? 'create the administrator account'
                          : 'create an account'}
                      </Link>{' '}
                    </>
                  ) : null}
                  to start generating
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}