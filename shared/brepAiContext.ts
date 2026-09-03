import type { BrepProject } from './brepProject.ts';
import {
  getBrepProjectArtifact,
  type BrepProjectArtifactData,
} from './brepProjectArtifact.ts';
import { normalizeBrepAiProjectCandidate } from './brepAiProject.ts';

export type BrepAiBranchMessage = {
  id: string;
  role: string;
  parts: unknown;
};

export type BrepAiSourceRevision = {
  messageId: string;
  artifact: BrepProjectArtifactData;
  project: BrepProject;
};

export class BrepAiContextError extends Error {
  constructor(
    public readonly code: 'invalid_source_revision',
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

/** Serialize only canonical editable source semantics for model context. */
export function serializeBrepAiProjectContext(project: unknown): string {
  return JSON.stringify(normalizeBrepAiProjectCandidate(project), null, 2);
}
