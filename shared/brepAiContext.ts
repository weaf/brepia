import type { BrepProject } from './brepProject.ts';
import { getBrepProjectArtifact } from './brepProjectArtifact.ts';
import { normalizeBrepAiProjectCandidate } from './brepAiProject.ts';
import type { BrepProjectArtifactData } from './chatAi.ts';

export type BrepAiBranchMessage = {
  id: string;
  role: string;
  parts: unknown;
};

export type BrepAiTreeMessage = BrepAiBranchMessage & {
  parent_message_id: string | null;
};

export type BrepAiSourceRevision = {
  messageId: string;
  artifact: BrepProjectArtifactData;
  project: BrepProject;
};

export class BrepAiContextError extends Error {
  constructor(
    public readonly code: 'invalid_source_revision' | 'invalid_branch',
    message: string,
  ) {
    super(message);
    this.name = 'BrepAiContextError';
  }
}

function hasBrepProjectMarker(parts: unknown): boolean {
  return (
    Array.isArray(parts) &&
    parts.some(
      (part) =>
        part !== null &&
        typeof part === 'object' &&
        !Array.isArray(part) &&
        (part as { type?: unknown }).type === 'data-brep-project',
    )
  );
}

/**
 * Resolve the BRep source revision nearest to the active branch leaf.
 *
 * A follow-up user message can itself be the current conversation leaf, so the
 * authoritative BRep source is the nearest preceding assistant revision rather
 * than necessarily the leaf message. If the nearest source marker is malformed,
 * fail closed instead of silently falling back to an older project snapshot.
 */
export function resolveActiveBrepAiSource(
  messages: readonly BrepAiBranchMessage[],
): BrepAiSourceRevision | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!hasBrepProjectMarker(message.parts)) continue;

    if (message.role !== 'assistant') {
      throw new BrepAiContextError(
        'invalid_source_revision',
        `Native BRep source marker on message ${message.id} is not an assistant revision.`,
      );
    }

    const artifact = getBrepProjectArtifact(message.parts);
    if (!artifact) {
      throw new BrepAiContextError(
        'invalid_source_revision',
        `Native BRep source revision ${message.id} is invalid.`,
      );
    }

    const project = normalizeBrepAiProjectCandidate(artifact.source.source);
    return { messageId: message.id, artifact, project };
  }

  return undefined;
}

/**
 * Build the exact root-to-leaf branch from persisted message-tree rows and
 * resolve the same authoritative BRep source used by the AI server.
 *
 * Product views must not assume that current_message_leaf_id is itself a source
 * revision: user prompts and failed/limitation assistant turns can legitimately
 * be leaves while the nearest preceding data-brep-project remains authoritative.
 */
export function resolveActiveBrepAiSourceForLeaf(
  messages: readonly BrepAiTreeMessage[],
  leafMessageId: string,
): BrepAiSourceRevision | undefined {
  const byId = new Map<string, BrepAiTreeMessage>();
  for (const message of messages) {
    if (byId.has(message.id)) {
      throw new BrepAiContextError(
        'invalid_branch',
        `Duplicate message ${message.id} in native BRep branch data.`,
      );
    }
    byId.set(message.id, message);
  }

  const reversedBranch: BrepAiBranchMessage[] = [];
  const visited = new Set<string>();
  let currentId: string | null = leafMessageId;

  while (currentId) {
    if (visited.has(currentId)) {
      throw new BrepAiContextError(
        'invalid_branch',
        `Cycle detected in native BRep message branch at ${currentId}.`,
      );
    }
    visited.add(currentId);

    const message = byId.get(currentId);
    if (!message) {
      throw new BrepAiContextError(
        'invalid_branch',
        `Native BRep message branch is missing ${currentId}.`,
      );
    }

    reversedBranch.push({
      id: message.id,
      role: message.role,
      parts: message.parts,
    });
    currentId = message.parent_message_id;
  }

  return resolveActiveBrepAiSource(reversedBranch.reverse());
}

/** Serialize only canonical editable source semantics for model context. */
export function serializeBrepAiProjectContext(project: unknown): string {
  return JSON.stringify(normalizeBrepAiProjectCandidate(project), null, 2);
}
