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
