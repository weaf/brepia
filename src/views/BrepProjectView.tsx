import { ChatTitle } from '@/components/chat/ChatTitle';
import { BrepChatSession } from '@/components/brep/BrepChatSession';
import {
  BrepProjectEditorProvider,
  BrepProjectParametersPanel,
  BrepProjectViewerPanel,
} from '@/components/brep/BrepProjectEditor';
import { ActivityIndicator } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { ConversationContext, useConversation } from '@/contexts/ConversationContext';
import { SelectedItemsContext } from '@/contexts/SelectedItemsContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  ensureInputRecords,
  messageRowToChatMessage,
  type ChatMessage,
} from '@/lib/aiMessages';
import { normalizeModelId } from '@shared/models';
import { supabase } from '@/lib/supabase';
import {
  persistUserMessage,
  useChangeRatingMutation,
  useMessagesQuery,
} from '@/services/messageService';
import {
  hiddenBrepRevisionIds,
  persistBrepProjectParameterRevision,
  persistBrepProjectSourceRevision,
  removeBrepProjectRevisionFromHistory,
  restoreBrepProjectRevision,
  selectBrepProjectRevision,
} from '@/services/brepProjectService';
import { getBrepProjectArtifact } from '@shared/brepProjectArtifact';
import { resolveActiveBrepAiSourceForLeaf } from '@shared/brepAiContext';
import type { BrepProject } from '@shared/brepProject';
import type { BrepParameterValues } from '@shared/brepProvider';
import type { AppUIMessage } from '@shared/chatAi';
import Tree from '@shared/Tree';
import type { Conversation, Message, Model } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Box } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { MessageItem } from '../types/misc.ts';
import { ConversationView } from './ConversationView';

function hasEmptyMetadata(metadata: unknown): boolean {
  return (
    metadata === undefined ||
    metadata === null ||
    (typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      Object.keys(metadata).length === 0)
  );
}

function isLifecycleOnlyBrepRevision(
  message: Pick<ChatMessage, 'role' | 'parts' | 'metadata'>,
): boolean {
  return (
    message.role === 'assistant' &&
    message.parts.length === 1 &&
    message.parts[0]?.type === 'data-brep-project' &&
    hasEmptyMetadata(message.metadata)
  );
}

export default function BrepProjectView() {
  const { id } = useParams({ from: '/_layout/_auth/brep/$id' });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [images, setImages] = useState<MessageItem[]>([]);
  const [mesh, setMesh] = useState<MessageItem | null>(null);

  const {
    data: conversation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['conversation', id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id ?? '')
        .single();
      if (conversationError) throw conversationError;
      const typedConversation = data as Conversation;
      if (typedConversation.type !== 'parametric') {
        throw new Error('This is not a persisted BRep project.');
      }
      return typedConversation;
    },
  });

  const { mutate: updateConversation, mutateAsync: updateConversationAsync } =
    useMutation({
      mutationFn: async (nextConversation: Conversation) => {
        const { data, error: updateError } = await supabase
          .from('conversations')
          .update(nextConversation)
          .eq('id', nextConversation.id)
          .eq('user_id', user?.id ?? '')
          .select()
          .single()
          .overrideTypes<Conversation>();
        if (updateError) throw updateError;
        return data;
      },
      onMutate(nextConversation) {
        const oldConversation = queryClient.getQueryData<Conversation>([
          'conversation',
          nextConversation.id,
        ]);
        queryClient.setQueryData(
          ['conversation', nextConversation.id],
          nextConversation,
        );
        return { oldConversation };
      },
      onSuccess(nextConversation) {
        queryClient.setQueryData(
          ['conversation', nextConversation.id],
          nextConversation,
        );
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      },
      onError(_error, nextConversation, context) {
        queryClient.setQueryData(
          ['conversation', nextConversation.id],
          context?.oldConversation,
        );
      },
    });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <ActivityIndicator label="Loading BRep project" />
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <main className="p-6 text-destructive">
        {error instanceof Error ? error.message : 'BRep project not found.'}
      </main>
    );
  }

  return (
    <ConversationContext.Provider
      value={{ conversation, updateConversation, updateConversationAsync }}
    >
      <SelectedItemsContext.Provider value={{ images, setImages, mesh, setMesh }}>
        <BrepProjectWorkspace key={conversation.id} />
      </SelectedItemsContext.Provider>
    </ConversationContext.Provider>
  );
}

function BrepProjectWorkspace() {
  const { conversation, updateConversation, updateConversationAsync } =
    useConversation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [model, setModel] = useState<Model>(
    conversation.settings?.model
      ? normalizeModelId(conversation.settings.model)
      : 'openai/gpt-5.6-sol',
  );
  const [executionMode, setExecutionMode] = useState<'cli' | 'streaming'>(
    conversation.settings?.openCodeExecutionMode ?? 'cli',
  );
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const isChatStreamingRef = useRef(false);
  const [mobilePreviewVersion, setMobilePreviewVersion] = useState(0);

  const handleChatLoadingChange = useCallback((loading: boolean) => {
    isChatStreamingRef.current = loading;
    setIsChatStreaming(loading);
  }, []);

  const { data: dbMessages = [], isFetched: areMessagesFetched } =
    useMessagesQuery();
  const chatMessages = useMemo(
    () => dbMessages.map(messageRowToChatMessage),
    [dbMessages],
  );
  const dbTree = useMemo(() => new Tree(chatMessages), [chatMessages]);
  const branchForLeaf = useCallback(
    (leafId: string): AppUIMessage[] =>
      dbTree
        .getPath(leafId)
        // Parameter changes and source restores are immutable lifecycle nodes,
        // not AI-authored chat turns. Keep them in the authoritative DB tree
        // for source resolution/branching while omitting them from the cached
        // chat branch so parameter commits cannot churn the AI client runtime.
        .filter((node) => !isLifecycleOnlyBrepRevision(node))
        .map((node) => ({
          id: node.id,
          role: node.role,
          parts: node.parts,
          metadata: node.metadata,
        })),
    [dbTree],
  );
  const leafId =
    conversation.current_message_leaf_id ?? dbMessages.at(-1)?.id ?? '';
  const leafPresentInMessages =
    !leafId || dbMessages.some((message) => message.id === leafId);
  const initialBranch = useMemo(
    () =>
      leafId && leafPresentInMessages ? branchForLeaf(leafId) : [],
    [branchForLeaf, leafId, leafPresentInMessages],
  );

  const activeSource = useMemo(
    () =>
      leafId && leafPresentInMessages
        ? resolveActiveBrepAiSourceForLeaf(dbMessages, leafId)
        : undefined,
    [dbMessages, leafId, leafPresentInMessages],
  );
  const revisions = useMemo(
    () =>
      dbMessages.flatMap((message) => {
        if (message.role !== 'assistant') return [];
        const artifact = getBrepProjectArtifact(message.parts);
        return artifact
          ? [
              {
                id: message.id,
                artifact,
              },
            ]
          : [];
      }),
    [dbMessages],
  );
  const hiddenRevisionIdSet = useMemo(
    () => new Set(hiddenBrepRevisionIds(conversation.settings)),
    [conversation.settings],
  );
  const editorRevisions = useMemo(
    () =>
      revisions.flatMap((revision, index) =>
        hiddenRevisionIdSet.has(revision.id)
          ? []
          : [{ id: revision.id, label: `Revision ${index + 1}` }],
      ),
    [hiddenRevisionIdSet, revisions],
  );

  const refreshWorkspace = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['messages', conversation.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['conversation', conversation.id],
      }),
      queryClient.invalidateQueries({ queryKey: ['conversations'] }),
    ]);
  }, [conversation.id, queryClient]);

  const updateSelectedModel = useCallback(
    (nextModel: Model) => {
      setModel(nextModel);
      updateConversation?.({
        ...conversation,
        settings: {
          ...(conversation.settings && typeof conversation.settings === 'object'
            ? conversation.settings
            : {}),
          model: nextModel,
        },
      });
    },
    [conversation, updateConversation],
  );

  const handleExecutionModeChange = useCallback(
    (nextMode: 'cli' | 'streaming') => {
      setExecutionMode(nextMode);
      updateConversation?.({
        ...conversation,
        settings: {
          ...(conversation.settings && typeof conversation.settings === 'object'
            ? conversation.settings
            : {}),
          openCodeExecutionMode: nextMode,
        },
      });
    },
    [conversation, updateConversation],
  );

  const handleSendParts = useCallback(
    async (parts: AppUIMessage['parts']) => {
      if (!user?.id) throw new Error('User must be authenticated');
      await ensureInputRecords({
        parts,
        conversationId: conversation.id,
        userId: user.id,
      });
      const userMessageId = await persistUserMessage({
        conversationId: conversation.id,
        parts,
        metadata: { model },
        parentMessageId: conversation.current_message_leaf_id ?? null,
      });
      return { userMessageId };
    },
    [conversation, model, user?.id],
  );

  const handleRetry = useCallback(
    async (assistant: ChatMessage) => {
      const parentId = assistant.parent_message_id;
      if (!parentId) return;
      await updateConversationAsync?.({
        ...conversation,
        current_message_leaf_id: parentId,
      });
    },
    [conversation, updateConversationAsync],
  );

  const handleEdit = useCallback(
    async (original: ChatMessage, parts: AppUIMessage['parts']) => {
      if (!user?.id) throw new Error('User must be authenticated');
      await ensureInputRecords({
        parts,
        conversationId: conversation.id,
        userId: user.id,
      });
      const parentId = original.parent_message_id;
      const newUserMessageId = await persistUserMessage({
        conversationId: conversation.id,
        parts,
        metadata: { model },
        parentMessageId: parentId,
      });
      return {
        newUserMessageId,
        parentPath: parentId ? branchForLeaf(parentId) : [],
      };
    },
    [branchForLeaf, conversation, model, user?.id],
  );

  const handleRestore = useCallback(
    async (assistant: ChatMessage) => {
      const newId = crypto.randomUUID();
      const parts = JSON.parse(JSON.stringify(assistant.parts));
      const metadata = JSON.parse(JSON.stringify(assistant.metadata ?? {}));
      const role: Message['role'] = 'assistant';
      const { error } = await supabase.from('messages').insert({
        id: newId,
        conversation_id: conversation.id,
        role,
        parts,
        metadata,
        parent_message_id: assistant.parent_message_id,
        rating: 0,
      });
      if (error) throw error;

      queryClient.setQueryData(
        ['conversation', conversation.id],
        (old: Conversation | undefined) =>
          old ? { ...old, current_message_leaf_id: newId } : old,
      );
      queryClient.setQueryData(
        ['messages', conversation.id],
        (old: Message[] | undefined): Message[] => [
          ...(old ?? []),
          {
            id: newId,
            conversation_id: conversation.id,
            role,
            parts,
            metadata,
            parent_message_id: assistant.parent_message_id,
            rating: 0,
            created_at: new Date().toISOString(),
          },
        ],
      );
      queryClient.invalidateQueries({
        queryKey: ['messages', conversation.id],
      });

      const parentPath = assistant.parent_message_id
        ? branchForLeaf(assistant.parent_message_id)
        : [];
      return {
        newBranch: [
          ...parentPath,
          { id: newId, role, parts, metadata },
        ] as AppUIMessage[],
      };
    },
    [branchForLeaf, conversation.id, queryClient],
  );

  const handleSelectLeaf = useCallback(
    async (messageId: string) => {
      await updateConversationAsync?.({
        ...conversation,
        current_message_leaf_id: messageId,
      });
    },
    [conversation, updateConversationAsync],
  );

  const { mutate: changeRating } = useChangeRatingMutation({
    conversationId: conversation.id,
  });
  const handleChangeRating = useCallback(
    (messageId: string, rating: number) => {
      changeRating({ messageId, rating });
    },
    [changeRating],
  );

  if (!areMessagesFetched || !leafPresentInMessages) {
    return (
      <div className="flex h-full items-center justify-center">
        <ActivityIndicator label="Synchronizing BRep conversation" />
      </div>
    );
  }

  if (!activeSource) {
    return (
      <main className="p-6 text-destructive">
        The active project branch has no valid BRep source snapshot.
      </main>
    );
  }

  return (
    <BrepProjectEditorProvider
      project={activeSource.artifact.source.source}
      packageTitle={activeSource.artifact.title}
      activeRevisionId={activeSource.messageId}
      revisions={editorRevisions}
      sourceEditingDisabled={isChatStreaming}
      onParameterValuesCommit={async (
        parameterValues: BrepParameterValues,
      ) => {
        await persistBrepProjectParameterRevision({
          conversationId: conversation.id,
          parentMessageId: leafId,
          artifact: activeSource.artifact,
          parameterValues,
        });
        await refreshWorkspace();
      }}
      onProjectSourceCommit={async (project: BrepProject) => {
        if (isChatStreamingRef.current) {
          throw new Error(
            'BRep feature editing is disabled while the current AI turn is streaming.',
          );
        }
        await persistBrepProjectSourceRevision({
          conversationId: conversation.id,
          parentMessageId: leafId,
          artifact: activeSource.artifact,
          project,
        });
        await refreshWorkspace();
      }}
      onSelectRevision={async (messageId) => {
        await selectBrepProjectRevision({
          conversationId: conversation.id,
          messageId,
        });
        await refreshWorkspace();
      }}
      onRestoreRevision={async (messageId) => {
        await restoreBrepProjectRevision({
          conversationId: conversation.id,
          sourceMessageId: messageId,
        });
        await refreshWorkspace();
      }}
      onDeleteRevision={async (messageId) => {
        await removeBrepProjectRevisionFromHistory({
          conversationId: conversation.id,
          messageId,
          activeRevisionId: activeSource.messageId,
        });
        await refreshWorkspace();
      }}
    >
      <ConversationView
        hasParameters
        mobilePreviewKey={`brep:${activeSource.messageId}`}
        mobilePreviewVersion={mobilePreviewVersion}
        chatPanelSlot={
          <>
            <div className="flex w-full items-center justify-between gap-3 border-b border-adam-neutral-700 px-4 py-3 md:pl-12">
              <div className="min-w-0 flex-1">
                <ChatTitle />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="[@media(min-width:1025px)]:hidden"
                  onClick={() =>
                    setMobilePreviewVersion((current) => current + 1)
                  }
                >
                  <Box className="mr-1 h-4 w-4" />
                  Model
                </Button>
                <span className="hidden text-xs text-adam-text-tertiary sm:inline">
                  {isChatStreaming ? 'AI editing…' : 'Native BRep'}
                </span>
              </div>
            </div>
            <BrepChatSession
              conversation={conversation}
              dbMessages={dbMessages}
              initialBranch={initialBranch}
              model={model}
              setModel={updateSelectedModel}
              executionMode={executionMode}
              onExecutionModeChange={handleExecutionModeChange}
              onSendParts={handleSendParts}
              onRetry={handleRetry}
              onEdit={handleEdit}
              onRestore={handleRestore}
              onSelectLeaf={handleSelectLeaf}
              branchForLeaf={branchForLeaf}
              onChangeRating={handleChangeRating}
              onLoadingChange={handleChatLoadingChange}
            />
          </>
        }
        previewSlot={<BrepProjectViewerPanel />}
        parametersSlot={<BrepProjectParametersPanel />}
        mobilePreviewSlot={<BrepProjectViewerPanel isMobile />}
        mobileParametersSlot={<BrepProjectParametersPanel />}
      />
    </BrepProjectEditorProvider>
  );
}
