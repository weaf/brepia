import { Chat } from '@ai-sdk/react';
import { useEffect, useMemo, useRef } from 'react';
import type { AppUIMessage } from '@shared/chatAi';

const MAX_CACHE_SIZE = 10;

const chatCache = new Map<string, Chat<AppUIMessage>>();
type ReactChatInit = ConstructorParameters<typeof Chat<AppUIMessage>>[0];

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
      onToolCall: (ctx) => refs.onToolCall.current?.(ctx),
      sendAutomaticallyWhen: (ctx) =>
        refs.sendAutomaticallyWhen.current?.(ctx) ?? false,
    });

    chatCache.set(id, created);
    evictIfNeeded();
    return created;
  }, [id, refs]);

  // Android browsers can suspend a background tab and tear down its HTTP/SSE
  // connection. The server keeps consuming/persisting the AI stream, but the
  // cached client Chat can remain stuck in `error` with an older in-memory
  // branch. When React Query refreshes the DB branch on focus, adopt that
  // persisted snapshot as long as we are not actively streaming. This also
  // clears the transient network error once the authoritative branch arrives.
  useEffect(() => {
    if (chat.status === 'streaming' || chat.status === 'submitted') return;
    if (!canReplaceWithPersistedMessages(chat.messages, messages)) return;
    if (messageSnapshot(chat.messages) === messageSnapshot(messages)) return;

    chat.messages = messages;
    if (chat.status === 'error') chat.clearError();
  }, [chat, messages]);

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
  refs.sendAutomaticallyWhen.current = sendAutomaticallyWhen;
  const chat = new Chat<AppUIMessage>({
    ...rest,
    id,
    onError: (error) => refs.onError.current?.(error),
    onFinish: (ctx) => refs.onFinish.current?.(ctx),
    onData: (ctx) => refs.onData.current?.(ctx),
    onToolCall: (ctx) => refs.onToolCall.current?.(ctx),
    sendAutomaticallyWhen: (ctx) =>
      refs.sendAutomaticallyWhen.current?.(ctx) ?? false,
  });

  chatCache.set(id, chat);
  evictIfNeeded();
  return chat;
}
