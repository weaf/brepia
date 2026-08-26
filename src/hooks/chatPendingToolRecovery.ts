export type PendingClientToolCall = {
  toolName: 'build_parametric_model' | 'answer_user';
  toolCallId: string;
  input: unknown;
};

type ToolPartLike = {
  type: string;
  state?: string;
  toolCallId?: unknown;
  input?: unknown;
};

type MessageLike = {
  role: string;
  parts: readonly ToolPartLike[];
};

/**
 * Return unresolved pCAD client tools from the newest assistant turn only.
 *
 * Historical dangling tool rows can remain in persisted conversation history
 * after the server-side branch sanitizer made a later turn usable. Replaying
 * one of those older tools would rebuild a stale artifact. Recovery therefore
 * belongs exclusively to the latest assistant turn, which is the only turn
 * that can legitimately be waiting for the current browser to execute a tool.
 */
export function pendingClientToolCalls(
  messages: readonly MessageLike[],
): PendingClientToolCall[] {
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  if (!latestAssistant) return [];

  const pending: PendingClientToolCall[] = [];
  for (const part of latestAssistant.parts) {
    if (
      (part.type === 'tool-build_parametric_model' ||
        part.type === 'tool-answer_user') &&
      part.state === 'input-available' &&
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
  return pending;
}

/** Filter persisted pending tools that have not already run in this client. */
export function pendingClientToolsNeedingRecovery(
  messages: readonly MessageLike[],
  handledToolCallIds: ReadonlySet<string>,
): PendingClientToolCall[] {
  return pendingClientToolCalls(messages).filter(
    (toolCall) => !handledToolCallIds.has(toolCall.toolCallId),
  );
}
