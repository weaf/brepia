type ActiveGenerationEntry = {
  controller: AbortController;
  runId: symbol;
};

const activeGenerations = new Map<string, ActiveGenerationEntry>();

function generationKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`;
}

export type ActiveGeneration = {
  signal: AbortSignal;
  finish: () => void;
};

export function beginActiveGeneration(
  userId: string,
  conversationId: string,
): ActiveGeneration {
  const key = generationKey(userId, conversationId);
  const previous = activeGenerations.get(key);
  previous?.controller.abort();

  const entry: ActiveGenerationEntry = {
    controller: new AbortController(),
    runId: Symbol('generation'),
  };
  activeGenerations.set(key, entry);

  return {
    signal: entry.controller.signal,
    finish: () => {
      if (activeGenerations.get(key)?.runId === entry.runId) {
        activeGenerations.delete(key);
      }
    },
  };
}

export function cancelActiveGeneration(
  userId: string,
  conversationId: string,
): boolean {
  const key = generationKey(userId, conversationId);
  const entry = activeGenerations.get(key);
  if (!entry) return false;

  activeGenerations.delete(key);
  entry.controller.abort();
  return true;
}

/**
 * Stop whichever active AI generation owns a conversation without requiring
 * the mesh layer to know the authenticated user id a second time.
 * Conversation ids are globally unique UUIDs, so at most one active entry is
 * expected to match. Scanning also keeps the normal user+conversation key used
 * by begin/cancel unchanged.
 */
export function cancelActiveGenerationForConversation(
  conversationId: string,
): boolean {
  const suffix = `:${conversationId}`;
  let cancelled = false;

  for (const [key, entry] of activeGenerations) {
    if (!key.endsWith(suffix)) continue;
    activeGenerations.delete(key);
    entry.controller.abort();
    cancelled = true;
  }

  return cancelled;
}

/**
 * Mesh tools execute inside streamText. AI SDK converts an execute() rejection
 * into a tool-error part before starting the next model step. Schedule the
 * abort on the next macrotask so that error can be emitted/persisted first,
 * while still cancelling the multi-step agent loop before another backend
 * generation can be requested.
 */
export function scheduleActiveGenerationCancellation(
  conversationId: string,
): void {
  setTimeout(() => {
    cancelActiveGenerationForConversation(conversationId);
  }, 0);
}
