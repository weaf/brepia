import { Chat } from '@ai-sdk/react';
import { useEffect, useMemo, useRef } from 'react';
import type { AppUIMessage } from '@shared/chatAi';

const MAX_CACHE_SIZE = 10;

const chatCache = new Map<string, Chat<AppUIMessage>>();
type ReactChatInit = ConstructorParameters<typeof Chat<AppUIMessage>>[0];
type ToolCallCallbackArg = Parameters<
  NonNullable<ReactChatInit['onToolCall']>
>[0];

type CallbackRefs = {
  onError: { current: ReactChatInit['onError'] };
  onFinish: { current: ReactChatInit['onFinish'] };
  onData: { current: ReactChatInit['onData'] };
  onToolCall: { current: ReactChatInit['onToolCall'] };
  sendAutomaticallyWhen: {
    current: ReactChatInit['sendAutomaticallyWhen'];
  };
};

const callbackRefs = new Map<string, CallbackRefs>();
const handledToolCallIds = new Map<string, Set<string>>();

function refsFor(id: string): CallbackRefs {
  let refs = callbackRefs.get(id);
  if (!refs) {
    refs = {
      onError: { current: undefined },
      onFinish: { current: undefined },
      onData: { current: undefined },
      onToolCall: { current: undefined },
      sendAutomaticallyWhen: { current: undefined },
    };
    callbackRefs.set(id, refs);
  }
  return refs;
}

function handledToolsFor(id: string): Set<string> {
  let handled = handledToolCallIds.get(id);
  if (!handled) {
    handled = new Set<string>();
    handledToolCallIds.set(id, handled);
  }
  return handled;
}

function touch(id: string) {
  const chat = chatCache.get(id);
  if (!chat) return;
  chatCache.delete(id);
  chatCache.set(id, chat);
}

function evictIfNeeded() {
  while (chatCache.size > MAX_CACHE_SIZE) {
    // Truthy-check the value would treat an empty-string id as iterator-end,
    // letting the cache grow unbounded. Use `done` instead so any string key
    // (including '') is correctly evicted.
    const result = chatCache.keys().next();
    if (result.done) break;
    chatCache.delete(result.value);
    callbackRefs.delete(result.value);
    handledToolCallIds.delete(result.value);
  }
}

function messageSnapshot(messages: readonly AppUIMessage[]): string {
  return JSON.stringify(
    messages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts,
      metadata: message.metadata,
    })),
  );
}

function canReplaceWithPersistedMessages(
  liveMessages: readonly AppUIMessage[],
  persistedMessages: readonly AppUIMessage[],
): boolean {
  if (persistedMessages.length === 0) return false;

  // While a response is only present in the in-memory Chat, the DB branch is
  // one message shorter and still ends at the user prompt. Do not erase that
  // partial assistant. Once the server-side stream consumer persists the
  // assistant, the persisted branch catches up and becomes authoritative.
  if (persistedMessages.length < liveMessages.length) {
    const liveLast = liveMessages.at(-1);
    const persistedLast = persistedMessages.at(-1);
    if (liveLast?.role === 'assistant' && persistedLast?.role === 'user') {
      return false;
    }
  }

  return true;
}

function pendingClientToolCalls(messages: readonly AppUIMessage[]) {
  const pending: Array<{
    toolName: 'build_parametric_model' | 'answer_user';
    toolCallId: string;
    input: unknown;
  }> = [];

  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.parts) {
      if (
        (part.type === 'tool-build_parametric_model' ||
          part.type === 'tool-answer_user') &&
        part.state === 'input-available' &&
        'toolCallId' in part &&
        typeof part.toolCallId === 'string' &&
        'input' in part
      ) {
        pending.push({
          toolName:
            part.type === 'tool-build_parametric_model'
              ? 'build_parametric_model'
              : 'answer_user',
          toolCallId: part.toolCallId,
          input: part.input,
        });
      }
    }
  }

  return pending;
}

export type CachedAiChatOptions = Omit<ReactChatInit, 'id'> & {
  id: string;
};

export function useCachedAiChat({
  id,
  messages,
  transport,
  onError,
  onFinish,
  onData,
  onToolCall,
  sendAutomaticallyWhen,
  ...rest
}: CachedAiChatOptions) {
  const refs = refsFor(id);
  const handled = handledToolsFor(id);
  const initialConfigRef = useRef({ id, messages, transport, rest });
  if (initialConfigRef.current.id !== id) {
    initialConfigRef.current = { id, messages, transport, rest };
  }

  useEffect(() => {
    refs.onError.current = onError;
    refs.onFinish.current = onFinish;
    refs.onData.current = onData;
    refs.onToolCall.current = onToolCall;
    refs.sendAutomaticallyWhen.current = sendAutomaticallyWhen;
  });

  const chat = useMemo(() => {
    const existing = chatCache.get(id);
    if (existing) {
      touch(id);
      return existing;
    }

    const initial = initialConfigRef.current;
    const created = new Chat<AppUIMessage>({
      ...initial.rest,
      id,
      messages: initial.messages,
      transport: initial.transport,
      onError: (error) => refs.onError.current?.(error),
      onFinish: (ctx) => refs.onFinish.current?.(ctx),
      onData: (ctx) => refs.onData.current?.(ctx),
      onToolCall: (ctx) => {
        handled.add(ctx.toolCall.toolCallId);
        return refs.onToolCall.current?.(ctx);
      },
      sendAutomaticallyWhen: (ctx) =>
        refs.sendAutomaticallyWhen.current?.(ctx) ?? false,
    });

    chatCache.set(id, created);
    evictIfNeeded();
    return created;
  }, [handled, id, refs]);

  // Android browsers can suspend a background tab and tear down its HTTP/SSE
  // connection. The server keeps consuming/persisting the AI stream, but the
  // cached client Chat can remain stuck in `error` with an older in-memory
  // branch. When React Query refreshes the DB branch on focus, adopt that
  // persisted snapshot as long as we are not actively streaming. This also
  // clears the transient network error once the authoritative branch arrives.
  useEffect(() => {
    if (chat.status === 'streaming' || chat.status === 'submitted') return;

    if (
      canReplaceWithPersistedMessages(chat.messages, messages) &&
      messageSnapshot(chat.messages) !== messageSnapshot(messages)
    ) {
      chat.messages = messages;
    }

    if (chat.status === 'error' && chat.messages.length > 0) {
      chat.clearError();
    }

    // A disconnect can happen after the server has emitted and persisted a
    // client-executed CAD tool call but before the browser received it. Re-run
    // only known idempotent client tools that are still input-available. The
    // normal live onToolCall path records the same id first, preventing a
    // duplicate execution when no disconnect occurred.
    for (const toolCall of pendingClientToolCalls(chat.messages)) {
      if (handled.has(toolCall.toolCallId)) continue;
      handled.add(toolCall.toolCallId);
      void refs.onToolCall.current?.({ toolCall } as ToolCallCallbackArg);
    }
  }, [chat, handled, messages, refs]);

  return chat;
}

export function createAndCacheAiChat(
  options: Omit<
    ReactChatInit,
    'onError' | 'onFinish' | 'onData' | 'onToolCall'
  > & {
    id: string;
  },
) {
  const { id, sendAutomaticallyWhen, ...rest } = options;
  const refs = refsFor(id);
  const handled = handledToolsFor(id);
  refs.sendAutomaticallyWhen.current = sendAutomaticallyWhen;
  const chat = new Chat<AppUIMessage>({
    ...rest,
    id,
    onError: (error) => refs.onError.current?.(error),
    onFinish: (ctx) => refs.onFinish.current?.(ctx),
    onData: (ctx) => refs.onData.current?.(ctx),
    onToolCall: (ctx) => {
      handled.add(ctx.toolCall.toolCallId);
      return refs.onToolCall.current?.(ctx);
    },
    sendAutomaticallyWhen: (ctx) =>
      refs.sendAutomaticallyWhen.current?.(ctx) ?? false,
  });

  chatCache.set(id, chat);
  evictIfNeeded();
  return chat;
}
