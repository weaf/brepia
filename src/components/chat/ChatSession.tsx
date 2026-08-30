import { MessageBubble } from '@/components/chat/MessageBubble';
import { CreativeGenerationActivity } from '@/components/chat/CreativeGenerationActivity';
import { SuggestionPills } from '@/components/chat/SuggestionPills';
import TextAreaChat from '@/components/TextAreaChat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useCachedAiChat } from '@/hooks/useCachedAiChat';
import {
  CONNECTION_INTERRUPTED_MESSAGE,
  userFacingChatError,
} from '@/hooks/chatErrorPresentation';
import { useToast } from '@/hooks/use-toast';
import { previewScadColoredViaToolWorker } from '@/worker/toolWorker';
import { apiUrl } from '@/services/api';
import { messageRowToChatMessage, type ChatMessage } from '@/lib/aiMessages';
import { getCreativeInputValidationIssue } from '@/lib/creativeInputValidation';
import { collectStuckToolRecovery } from '@/components/chat/stuckToolRecovery';
import {
  AssistantRowMissingError,
  shouldPollForPendingAssistant,
} from '@/services/messageService';
import { supabase } from '@/lib/supabase';
import {
  generateColoredPreview,
  generateInspectionPreview,
  generatePreview,
} from '@/utils/meshUtils';
import type {
  AppUIMessage,
  ConversationSuggestionsUpdate,
  ConversationTitleUpdate,
} from '@shared/chatAi';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import Tree from '@shared/Tree';
import { isParametricArtifact } from '@shared/parametricParts';
import type {
  Conversation,
  Message,
  Model,
  ParametricArtifact,
} from '@shared/types';
import { useQueryClient } from '@tanstack/react-query';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef } from 'react';

interface ChatSessionProps {
  conversation: Conversation;
  /** Raw message rows from the DB query — used to build the sibling tree. */
  dbMessages: Message[];
  /** Branch to seed `chat.messages` on mount of this conversation's Chat. */
  initialBranch: AppUIMessage[];
  model: Model;
  setModel: (model: Model) => void;
  /** Current execution mode for this conversation ('cli' | 'streaming'). */
  executionMode?: 'cli' | 'streaming';
  /** Called when the execution mode is toggled. Persists to conversation settings. */
  onExecutionModeChange?: (mode: 'cli' | 'streaming') => void;

  // Action handlers — each does its DB writes in the parent and returns
  // the data ChatSession needs to keep `chat.messages` in sync. See the
  // architecture plan §5 for the exact contract.
  onSendParts: (
    parts: AppUIMessage['parts'],
  ) => Promise<{ userMessageId: string }>;
  onRetry: (assistant: ChatMessage) => Promise<void>;
  onEdit: (
    original: ChatMessage,
    parts: AppUIMessage['parts'],
  ) => Promise<{ newUserMessageId: string; parentPath: AppUIMessage[] }>;
  onRestore: (assistant: ChatMessage) => Promise<{ newBranch: AppUIMessage[] }>;
  onSelectLeaf: (messageId: string) => Promise<void>;
  /** Pure tree walker — closes over the parent's `dbTree`. */
  branchForLeaf: (leafId: string) => AppUIMessage[];

  onToolOutput: (
    messageId: string,
    nextParts: AppUIMessage['parts'],
  ) => Promise<void>;
  onChangeRating: (messageId: string, rating: number) => void;
  onViewArtifact: (artifact: ParametricArtifact, messageId: string) => void;
  onViewMesh: (meshId: string, messageId: string) => void;
  /** Fired whenever the SDK's submitted/streaming flag flips. Lets the
   *  parent show the bouncing loader in the preview pane while the model
   *  is still producing the next artifact. */
  onLoadingChange?: (isLoading: boolean) => void;
}

type ToolMessagePart = Extract<
  AppUIMessage['parts'][number],
  { state: string }
>;

function isToolMessagePart(
  part: AppUIMessage['parts'][number],
): part is ToolMessagePart {
  return part.type.startsWith('tool-') && 'state' in part;
}

function lastAssistantMessageIsCompleteWithParametricBuild({
  messages,
}: {
  messages: AppUIMessage[];
}) {
  const message = messages[messages.length - 1];
  if (!message || message.role !== 'assistant') return false;
  if (message.parts.some((part) => part.type === 'tool-answer_user')) {
    return false;
  }

  const lastStepStartIndex = message.parts.reduce(
    (lastIndex, part, index) =>
      part.type === 'step-start' ? index : lastIndex,
    -1,
  );
  const toolParts = message.parts
    .slice(lastStepStartIndex + 1)
    .filter(isToolMessagePart);

  return (
    toolParts.some((part) => part.type === 'tool-build_parametric_model') &&
    !toolParts.some((part) => part.type === 'tool-answer_user') &&
    toolParts.every(
      (part) =>
        part.state === 'output-available' || part.state === 'output-error',
    )
  );
}

function answerUserInput(input: unknown): { message: string } | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const message = (input as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? { message } : null;
}

/**
 * Owns the AI-SDK Chat lifecycle for a conversation. Everything that touches
 * `chat.sendMessage` / `chat.regenerate` / `chat.setMessages` /
 * `chat.addToolOutput` lives here — and only here. DB writes are delegated
 * upward to `EditorView` via the `on*` props, which keeps the two layers
 * honest: the parent owns "what the tree looks like", this component owns
 * "what the SDK is doing right now".
 *
 * The split means we never have a stale `chat.messages` racing against a
 * React Query refetch: a chat-state update only happens as the direct
 * consequence of an action handler that the parent already awaited.
 */
export function ChatSession({
  conversation,
  dbMessages,
  initialBranch,
  model,
  setModel,
  executionMode = 'cli',
  onExecutionModeChange,
  onSendParts,
  onRetry,
  onEdit,
  onRestore,
  onSelectLeaf,
  branchForLeaf,
  onToolOutput,
  onChangeRating,
  onViewArtifact,
  onViewMesh,
  onLoadingChange,
}: ChatSessionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ───────────────────────────────────────────────────────────────────────
  // Transport — strips client state out of the wire body. Server reads the
  // branch from `conversations.current_message_leaf_id` and walks parents
  // in the DB, so anything the SDK might put in `messages` is ignored.
  // ───────────────────────────────────────────────────────────────────────
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AppUIMessage>({
        api: apiUrl(
          conversation.type === 'creative'
            ? 'creative-chat'
            : 'parametric-chat',
        ),
        headers: authHeaders,
        prepareSendMessagesRequest: ({ body }) => ({
          body: {
            conversationId: conversation.id,
            model,
            openCodeExecutionMode: executionMode,
            ...(body ?? {}),
          },
        }),
      }),
    [authHeaders, conversation.id, conversation.type, executionMode, model],
  );

  // ───────────────────────────────────────────────────────────────────────
  // Tool-output bridge via `onToolCall` (no useEffect, no dedupe ref).
  //
  // The SDK fires this exactly once per tool call as soon as the model's
  // input completes. We compile the OpenSCAD locally, upload the preview,
  // persist the assistant's parts to DB (so the server reads the right
  // thing on auto-continuation), and only then call `chat.addToolOutput`
  // which lets `sendAutomaticallyWhen` continue the CAD build/review loop.
  // ───────────────────────────────────────────────────────────────────────
  const chatRef = useRef<ReturnType<typeof useCachedAiChat> | null>(null);
  // Latest `chat.messages` snapshot for use inside `onToolCall` (callbacks
  // baked at Chat-init time would otherwise close over the initial array).
  const messagesRef = useRef<AppUIMessage[]>(initialBranch);
  // Set when persisting a tool's `output-available` to the DB fails. The
  // server reads the branch from the DB (never from client-sent messages), so
  // auto-resubmitting after a failed persist would continue against a stale
  // branch — at best a wasted round-trip the server has to recover from. While
  // this is set, `sendAutomaticallyWhen` returns false so the loop pauses and
  // the user can retry. Reset at the top of each `handleToolCall`.
  const persistFailedRef = useRef(false);

  const handleToolCall = useCallback(
    async ({
      toolCall,
    }: {
      toolCall: {
        toolName: string;
        toolCallId: string;
        input: unknown;
      };
    }) => {
      if (
        toolCall.toolName !== 'build_parametric_model' &&
        toolCall.toolName !== 'answer_user'
      ) {
        return;
      }
      const chat = chatRef.current;
      if (!chat) return;

      persistFailedRef.current = false;

      const findAssistant = (msgs: readonly AppUIMessage[]) =>
        msgs.find(
          (msg) =>
            msg.role === 'assistant' &&
            msg.parts.some(
              (p) =>
                p.type === `tool-${toolCall.toolName}` &&
                'toolCallId' in p &&
                p.toolCallId === toolCall.toolCallId,
            ),
        );
      const assistant =
        findAssistant(chat.messages as AppUIMessage[]) ??
        findAssistant(messagesRef.current);

      if (toolCall.toolName === 'answer_user') {
        const output = answerUserInput(toolCall.input);
        if (!output) {
          const errorText = 'answer_user input was missing a message.';
          if (assistant) {
            const nextParts = assistant.parts.map((existing) =>
              existing.type === 'tool-answer_user' &&
              existing.toolCallId === toolCall.toolCallId
                ? ({
                    type: 'tool-answer_user',
                    toolCallId: toolCall.toolCallId,
                    state: 'output-error',
                    input: toolCall.input,
                    errorText,
                  } as AppUIMessage['parts'][number])
                : existing,
            ) as AppUIMessage['parts'];
            try {
              await onToolOutput(assistant.id, nextParts);
            } catch (persistError) {
              console.warn(
                'Failed to persist answer_user error to DB:',
                persistError,
              );
            }
          }
          chat.addToolOutput({
            state: 'output-error',
            tool: 'answer_user',
            toolCallId: toolCall.toolCallId,
            errorText,
          });
          return;
        }

        const successPart = {
          type: 'tool-answer_user',
          toolCallId: toolCall.toolCallId,
          state: 'output-available',
          input: output,
          output,
        } as AppUIMessage['parts'][number];

        if (assistant) {
          const nextParts = assistant.parts.map((existing) => {
            if (
              existing.type === 'tool-answer_user' &&
              existing.toolCallId === toolCall.toolCallId
            ) {
              return successPart;
            }
            if (
              (existing.type === 'reasoning' || existing.type === 'text') &&
              existing.state === 'streaming'
            ) {
              return { ...existing, state: 'done' as const };
            }
            return existing;
          }) as AppUIMessage['parts'];

          try {
            await onToolOutput(assistant.id, nextParts);
          } catch (persistError) {
            console.warn(
              'Failed to persist answer_user output to DB:',
              persistError,
            );
            toast({
              title: "Couldn't save the reply",
              description:
                'Your message is shown but may not survive a refresh. Please retry if it disappears.',
              variant: 'destructive',
            });
          }
        }

        chat.addToolOutput({
          tool: 'answer_user',
          toolCallId: toolCall.toolCallId,
          output,
        });
        return;
      }

      const buildNextParts = (
        replacement: AppUIMessage['parts'][number],
      ): AppUIMessage['parts'] | null => {
        if (!assistant) return null;
        return assistant.parts.map((existing) => {
          if (
            existing.type === 'tool-build_parametric_model' &&
            existing.toolCallId === toolCall.toolCallId
          ) {
            return existing.callProviderMetadata
              ? {
                  ...replacement,
                  callProviderMetadata: existing.callProviderMetadata,
                }
              : replacement;
          }
          if (
            (existing.type === 'reasoning' || existing.type === 'text') &&
            existing.state === 'streaming'
          ) {
            return { ...existing, state: 'done' as const };
          }
          return existing;
        }) as AppUIMessage['parts'];
      };

      const finishWithError = async (errorText: string) => {
        if (assistant) {
          const errorPart = {
            type: 'tool-build_parametric_model',
            toolCallId: toolCall.toolCallId,
            state: 'output-error',
            input: toolCall.input,
            errorText,
          } as AppUIMessage['parts'][number];
          const nextParts = buildNextParts(errorPart);
          if (nextParts) {
            try {
              await onToolOutput(assistant.id, nextParts);
            } catch (persistError) {
              console.warn('Failed to persist tool error to DB:', persistError);
            }
          }
        }
        chat.addToolOutput({
          state: 'output-error',
          tool: 'build_parametric_model',
          toolCallId: toolCall.toolCallId,
          errorText,
        });
      };

      const input = isParametricArtifact(toolCall.input)
        ? toolCall.input
        : null;

      if (!input) {
        await finishWithError(
          'CAD tool input was not a valid OpenSCAD artifact.',
        );
        return;
      }

      try {
        const { stl, off } = await previewScadColoredViaToolWorker(input.code);
        let inspectionUploaded = false;
        try {
          if (user?.id) {
            const inspectionDataUrl = await generateInspectionPreview({
              stl,
              off,
            });
            const inspectionBlob = await fetch(inspectionDataUrl).then(
              (response) => response.blob(),
            );
            const inspectionPath = `${user.id}/${conversation.id}/inspection-preview-${toolCall.toolCallId}`;
            const { error: inspectionUploadError } = await supabase.storage
              .from('images')
              .upload(inspectionPath, inspectionBlob, {
                contentType: 'image/png',
                upsert: true,
              });
            if (inspectionUploadError) throw inspectionUploadError;
            inspectionUploaded = true;
          }
        } catch (uploadError) {
          console.warn(
            'Failed to upload OpenSCAD inspection preview:',
            uploadError,
          );
        }

        try {
          if (user?.id) {
            let thumbnailDataUrl: string | null = null;
            if (off) {
              thumbnailDataUrl = await generateColoredPreview(off);
            }
            if (!thumbnailDataUrl) {
              thumbnailDataUrl = await generatePreview(stl, 'stl');
            }
            const thumbnailBlob = await fetch(thumbnailDataUrl).then(
              (response) => response.blob(),
            );
            const previewPath = `${user.id}/${conversation.id}/preview-${toolCall.toolCallId}`;
            const { error: thumbnailUploadError } = await supabase.storage
              .from('images')
              .upload(previewPath, thumbnailBlob, {
                contentType: 'image/png',
                upsert: true,
              });
            if (thumbnailUploadError) throw thumbnailUploadError;
          }
        } catch (uploadError) {
          console.warn('Failed to upload OpenSCAD thumbnail:', uploadError);
        }

        const inspectionViews: Array<
          'ISO' | 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM'
        > = ['ISO', 'FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM'];
        const output = {
          status: 'success' as const,
          inspection: {
            views: inspectionViews,
            imageAttached: inspectionUploaded,
          },
          message: inspectionUploaded
            ? 'Compilation successful. Inspect the multi-view render in this tool result against the user request from every visible angle. If any required feature is missing, wrong, too simple, disconnected, non-printable, hidden from some view, or visually unclear, call build_parametric_model again with a corrected complete OpenSCAD script. If all views satisfy the request, give a concise final response.'
            : 'Compilation successful, but the multi-view preview sheet was not available. Review the OpenSCAD you wrote against the user request. If anything is missing, wrong, too simple, disconnected, non-printable, or visually unclear, call build_parametric_model again with a corrected complete OpenSCAD script. If it satisfies the request, give a concise final response.',
        };

        const successPart = {
          type: 'tool-build_parametric_model',
          toolCallId: toolCall.toolCallId,
          state: 'output-available',
          input,
          output,
        } as AppUIMessage['parts'][number];
        const nextParts = buildNextParts(successPart);

        if (assistant) {
          onViewArtifact(input, assistant.id);
        }

        if (nextParts && assistant) {
          try {
            await onToolOutput(assistant.id, nextParts);
          } catch (persistError) {
            console.warn('Failed to persist tool output to DB:', persistError);
            persistFailedRef.current = true;
            toast({
              title: "Couldn't save this step",
              description:
                "The model is shown but the build wasn't saved, so Adam paused. Please retry.",
              variant: 'destructive',
            });
          }
        }

        chat.addToolOutput({
          tool: 'build_parametric_model',
          toolCallId: toolCall.toolCallId,
          output,
        });
      } catch (error) {
        await finishWithError(
          `Compilation failed:\n${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [conversation.id, onToolOutput, onViewArtifact, toast, user?.id],
  );

  const chat = useCachedAiChat({
    id: conversation.id,
    messages: initialBranch,
    transport,
    onToolCall: handleToolCall,
    sendAutomaticallyWhen: (ctx) => {
      if (persistFailedRef.current) return false;
      return conversation.type === 'parametric'
        ? lastAssistantMessageIsCompleteWithParametricBuild(ctx)
        : lastAssistantMessageIsCompleteWithToolCalls(ctx);
    },
    onData: (part) => {
      if (part.type === 'data-title-update') {
        const { title } = part.data as ConversationTitleUpdate;
        queryClient.setQueryData(
          ['conversation', conversation.id],
          (old: Conversation | undefined) => (old ? { ...old, title } : old),
        );
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        return;
      }
      if (part.type === 'data-suggestions-update') {
        const { suggestions } = part.data as ConversationSuggestionsUpdate;
        queryClient.setQueryData(
          ['conversation', conversation.id],
          (old: Conversation | undefined) =>
            old
              ? {
                  ...old,
                  settings: {
                    ...(old.settings && typeof old.settings === 'object'
                      ? old.settings
                      : {}),
                    suggestions,
                  },
                }
              : old,
        );
      }
    },
    onFinish: ({ message }) => {
      if (message?.id) {
        queryClient.setQueryData(
          ['conversation', conversation.id],
          (old: Conversation | undefined) =>
            old ? { ...old, current_message_leaf_id: message.id } : old,
        );
      }
      queryClient.invalidateQueries({
        queryKey: ['messages', conversation.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversation', conversation.id],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      console.error('[chat]', error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Adam ran into a problem',
        description: message || 'The model call failed. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const {
    messages,
    status,
    error: chatError,
    stop,
    sendMessage,
    regenerate,
    setMessages,
  } = useChat<AppUIMessage>({ chat });

  const stopGeneration = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(
        apiUrl(
          conversation.type === 'creative'
            ? 'creative-chat'
            : 'parametric-chat',
        ),
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel',
            conversationId: conversation.id,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Cancel request failed with HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[chat-cancel]', error);
      toast({
        title: 'Could not stop generation',
        description: 'The server may still be completing this response.',
        variant: 'destructive',
      });
    } finally {
      stop();
    }
  }, [authHeaders, conversation.id, conversation.type, stop, toast]);

  useEffect(() => {
    chatRef.current = chat;
    messagesRef.current = messages;
  }, [chat, messages]);

  const recoveredChatRef = useRef<unknown>(null);
  useEffect(() => {
    if (recoveredChatRef.current === chat) return;
    recoveredChatRef.current = chat;

    const stuckByMessageId = collectStuckToolRecovery({
      status: chat.status,
      messages: chat.messages,
    }) as Map<string, AppUIMessage['parts']>;

    if (stuckByMessageId.size === 0) return;

    setMessages(
      (chat.messages as AppUIMessage[]).map((msg) =>
        stuckByMessageId.has(msg.id)
          ? { ...msg, parts: stuckByMessageId.get(msg.id)! }
          : msg,
      ),
    );

    for (const [messageId, nextParts] of stuckByMessageId) {
      void onToolOutput(messageId, nextParts).catch((err) => {
        if (err instanceof AssistantRowMissingError) {
          console.info(
            'Stuck-tool recovery: assistant row was never persisted; ' +
              'nothing to repair in DB (benign).',
          );
          return;
        }
        console.warn('Failed to persist stuck-tool recovery:', err);
      });
    }
  }, [chat, onToolOutput, setMessages]);

  const isRecoveringInterruptedTurn =
    status === 'error' &&
    !!chatError &&
    userFacingChatError(chatError).message === CONNECTION_INTERRUPTED_MESSAGE &&
    shouldPollForPendingAssistant(dbMessages);
  const isLoading =
    status === 'submitted' ||
    status === 'streaming' ||
    isRecoveringInterruptedTurn;

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const treeMessages = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const row of dbMessages) {
      byId.set(row.id, messageRowToChatMessage(row));
    }
    for (let i = 0; i < messages.length; i += 1) {
      const live = messages[i];
      const existing = byId.get(live.id);
      if (existing) {
        byId.set(live.id, {
          ...existing,
          parts: live.parts,
          metadata: live.metadata,
        });
      } else {
        const parent = i === 0 ? null : messages[i - 1].id;
        byId.set(live.id, {
          ...live,
          parent_message_id: parent,
          conversation_id: conversation.id,
        });
      }
    }
    return Array.from(byId.values());
  }, [dbMessages, messages, conversation.id]);

  const messageTree = useMemo(() => new Tree(treeMessages), [treeMessages]);
  const branchNodes = useMemo(
    () =>
      messages
        .map((m) => messageTree.allNodes.get(m.id))
        .filter((node): node is NonNullable<typeof node> => !!node),
    [messages, messageTree],
  );

  const lastAutoAppliedPreviewKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const preview = findLatestPreview(messages);
    if (!preview) return;
    const key =
      preview.type === 'artifact'
        ? `artifact:${preview.messageId}:${preview.artifact.code.length}`
        : `mesh:${preview.messageId}:${preview.meshId}`;
    if (lastAutoAppliedPreviewKeyRef.current === key) return;
    lastAutoAppliedPreviewKeyRef.current = key;
    if (preview.type === 'artifact') {
      onViewArtifact(preview.artifact, preview.messageId);
    } else {
      onViewMesh(preview.meshId, preview.messageId);
    }
  }, [messages, onViewArtifact, onViewMesh]);

  const handleSend = useCallback(
    async (parts: AppUIMessage['parts']) => {
      const issue = getCreativeInputValidationIssue({
        conversationType: conversation.type,
        model,
        parts,
      });

      if (issue) {
        toast({
          title: issue.title,
          description: issue.description,
        });
        return;
      }

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
      posthog.capture('message_sent', {
        type: conversation.type,
        model_name: model,
        text,
        image_count: imageCount,
        mesh_count: meshCount,
        conversation_id: conversation.id,
      });

      const { userMessageId } = await onSendParts(parts);
      await sendMessage(
        { id: userMessageId, parts, metadata: { model } },
        { body: { model } },
      );
    },
    [
      conversation.id,
      conversation.type,
      model,
      onSendParts,
      sendMessage,
      toast,
    ],
  );

  const handleEditUserText = useCallback(
    async (original: ChatMessage, text: string) => {
      const parts: AppUIMessage['parts'] = [{ type: 'text', text }];
      const { newUserMessageId, parentPath } = await onEdit(original, parts);
      setMessages(parentPath);
      await sendMessage(
        { id: newUserMessageId, parts, metadata: { model } },
        { body: { model } },
      );
    },
    [model, onEdit, sendMessage, setMessages],
  );

  const handleRetry = useCallback(
    async (assistant: ChatMessage, nextModel: Model) => {
      if (nextModel !== model) setModel(nextModel);
      await onRetry(assistant);
      await regenerate({
        messageId: assistant.id,
        body: { model: nextModel },
      });
    },
    [model, onRetry, regenerate, setModel],
  );

  const handleRestore = useCallback(
    async (assistant: ChatMessage) => {
      const { newBranch } = await onRestore(assistant);
      setMessages(newBranch);
    },
    [onRestore, setMessages],
  );

  const handleSelectLeaf = useCallback(
    async (messageId: string) => {
      await onSelectLeaf(messageId);
      setMessages(branchForLeaf(messageId));
    },
    [branchForLeaf, onSelectLeaf, setMessages],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    );
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [branchNodes, isLoading]);

  return (
    <>
      <ScrollArea
        className="relative w-full min-w-0 max-w-full flex-1 self-center overflow-x-hidden px-3 py-0 md:min-h-0 md:p-4 [&_[data-radix-scroll-area-viewport]]:overflow-x-hidden"
        ref={scrollRef}
      >
        <div className="pointer-events-none sticky left-0 top-0 z-50 h-3 bg-gradient-to-b from-adam-bg-secondary-dark/90 to-transparent md:hidden" />
        <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 pb-6 md:gap-8 md:pb-4">
          {branchNodes.map((node, index) => {
            const isLastMessage = index === branchNodes.length - 1;
            return (
              <MessageBubble
                key={node.id}
                message={node}
                isLoading={isLoading}
                isLastMessage={isLastMessage}
                currentModel={model}
                onSelectLeaf={(id) => void handleSelectLeaf(id)}
                onEditUserText={
                  node.role === 'user' ? handleEditUserText : undefined
                }
                onViewArtifact={(artifact) => onViewArtifact(artifact, node.id)}
                onViewMesh={(meshId) => onViewMesh(meshId, node.id)}
                onChangeRating={
                  node.role === 'assistant'
                    ? (rating) => onChangeRating(node.id, rating)
                    : undefined
                }
                onRetry={
                  node.role === 'assistant'
                    ? (nextModel) => void handleRetry(node, nextModel)
                    : undefined
                }
                onRestore={
                  node.role === 'assistant' && !isLastMessage
                    ? () => void handleRestore(node)
                    : undefined
                }
              />
            );
          })}
          {conversation.type === 'creative' && (
            <CreativeGenerationActivity conversationId={conversation.id} />
          )}
        </div>
      </ScrollArea>

      <div className="w-full shrink-0 self-center px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-4 md:pb-4">
        {!isLoading && (
          <div className="mx-auto max-w-3xl pt-1">
            <SuggestionPills
              suggestions={conversation.settings?.suggestions ?? []}
              onSelect={(suggestion) =>
                void handleSend([{ type: 'text', text: suggestion }])
              }
            />
          </div>
        )}
        <TextAreaChat
          type={conversation.type}
          onSubmit={(parts) => void handleSend(parts)}
          placeholder="Keep iterating with Adam..."
          isLoading={isLoading}
          stopGenerating={() => void stopGeneration()}
          model={model}
          setModel={setModel}
          conversation={conversation}
          executionMode={executionMode}
          onExecutionModeChange={onExecutionModeChange}
        />
      </div>
    </>
  );
}

type LatestPreview =
  | { type: 'artifact'; messageId: string; artifact: ParametricArtifact }
  | { type: 'mesh'; messageId: string; meshId: string }
  | null;

function findLatestPreview(messages: AppUIMessage[]): LatestPreview {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const message = messages[messageIndex];
    for (
      let partIndex = message.parts.length - 1;
      partIndex >= 0;
      partIndex -= 1
    ) {
      const part = message.parts[partIndex];
      if (
        part.type === 'tool-build_parametric_model' &&
        part.state !== 'input-streaming' &&
        isParametricArtifact(part.input)
      ) {
        return {
          type: 'artifact',
          messageId: message.id,
          artifact: part.input,
        };
      }
      if (
        part.type === 'tool-create_mesh' &&
        part.state === 'output-available'
      ) {
        return {
          type: 'mesh',
          messageId: message.id,
          meshId: part.output.id,
        };
      }
    }
  }
  return null;
}
