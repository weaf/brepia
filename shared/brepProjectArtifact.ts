import type { AppUIMessage, BrepProjectArtifactData } from './chatAi.ts';
import { normalizeParametricProjectSource } from './parametricProjectSource.ts';

export type BrepProjectBaselineMessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  parts: AppUIMessage['parts'];
  metadata: AppUIMessage['metadata'];
  parent_message_id: string | null;
};

function normalizeBrepArtifactData(value: unknown): BrepProjectArtifactData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('BRep project artifact must be an object.');
  }
  const artifact = value as Partial<BrepProjectArtifactData>;
  if (
    typeof artifact.title !== 'string' ||
    !artifact.title.trim() ||
    typeof artifact.version !== 'string' ||
    !artifact.version.trim()
  ) {
    throw new Error('BRep project artifact requires a title and version.');
  }
  const source = normalizeParametricProjectSource(artifact.source);
  if (source.kind !== 'brep') {
    throw new Error('BRep project artifact source must have kind brep.');
  }
  return {
    title: artifact.title.trim(),
    version: artifact.version.trim(),
    source,
  };
}

export function createBrepProjectArtifact(
  value: unknown,
): BrepProjectArtifactData {
  return normalizeBrepArtifactData(value);
}

export function getBrepProjectArtifact(
  parts: unknown,
): BrepProjectArtifactData | undefined {
  if (!Array.isArray(parts)) return undefined;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (
      !part ||
      typeof part !== 'object' ||
      Array.isArray(part) ||
      (part as { type?: unknown }).type !== 'data-brep-project'
    ) {
      continue;
    }
    try {
      return normalizeBrepArtifactData((part as { data?: unknown }).data);
    } catch {
      // An invalid historical snapshot must not become executable/viewable.
    }
  }
  return undefined;
}

/**
 * Establish the source baseline in the ordinary immutable message tree. The
 * assistant leaf is deliberately terminal: no AI tool call is implied.
 */
export function buildBrepProjectBaselineMessages({
  conversationId,
  userMessageId,
  assistantMessageId,
  artifact,
}: {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  artifact: BrepProjectArtifactData;
}): [BrepProjectBaselineMessageRow, BrepProjectBaselineMessageRow] {
  return [
    {
      id: userMessageId,
      conversation_id: conversationId,
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Created native BRep project: ${artifact.title}`,
        },
      ],
      metadata: {},
      parent_message_id: null,
    },
    {
      id: assistantMessageId,
      conversation_id: conversationId,
      role: 'assistant',
      parts: [{ type: 'data-brep-project', data: artifact }],
      metadata: {},
      parent_message_id: userMessageId,
    },
  ];
}
