import type { AppUIMessage } from '@shared/chatAi';
import {
  isBrepAiCreationRoute,
  type BrepAiSourceRevision,
} from '@shared/brepAiContext';

const BREP_HISTORY_SUMMARY_MAX_CHARS = 512;

export type BrepAiModelContextProjectionDiagnostics = {
  applied: boolean;
  inputMessageCount: number;
  outputMessageCount: number;
  removedBuildToolParts: number;
  removedBrepSnapshotParts: number;
  summarizedAcceptedBuilds: number;
  removedBuildInputBytes: number;
  removedBuildOutputBytes: number;
  removedSnapshotBytes: number;
};

export type BrepAiModelContextProjection = {
  messages: AppUIMessage[];
  diagnostics: BrepAiModelContextProjectionDiagnostics;
};

function jsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? '').byteLength;
  } catch {
    return 0;
  }
}

function compactAcceptedBuildSummary(part: unknown): string | undefined {
  if (!part || typeof part !== 'object' || Array.isArray(part)) return undefined;
  const record = part as Record<string, unknown>;
  if (
    record.type !== 'tool-build_brep_project' ||
    record.state !== 'output-available' ||
    !record.output ||
    typeof record.output !== 'object' ||
    Array.isArray(record.output)
  ) {
    return undefined;
  }

  const output = record.output as Record<string, unknown>;
  if (output.status !== 'success' || typeof output.message !== 'string') {
    return undefined;
  }

  const normalized = output.message.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  const bounded =
    normalized.length <= BREP_HISTORY_SUMMARY_MAX_CHARS
      ? normalized
      : `${normalized.slice(0, BREP_HISTORY_SUMMARY_MAX_CHARS - 1)}…`;
  return `Prior accepted Native BRep revision: ${bounded}`;
}

/**
 * Build a request-local provider branch for Native BRep follow-up turns.
 *
 * Durable UI/message history remains untouched and remains the source used for
 * branch/source resolution. The provider already receives the current canonical
 * project once through the BRep system context, so historical complete BRep tool
 * inputs and data snapshots are superseded state and are removed here. A bounded
 * server-derived success summary preserves useful revision intent without making
 * conversation history a geometry authority.
 */
export function projectBrepAiModelContext({
  messages,
  activeBrepSource,
}: {
  messages: readonly AppUIMessage[];
  activeBrepSource: BrepAiSourceRevision | undefined;
}): BrepAiModelContextProjection {
  const diagnostics: BrepAiModelContextProjectionDiagnostics = {
    applied: false,
    inputMessageCount: messages.length,
    outputMessageCount: messages.length,
    removedBuildToolParts: 0,
    removedBrepSnapshotParts: 0,
    summarizedAcceptedBuilds: 0,
    removedBuildInputBytes: 0,
    removedBuildOutputBytes: 0,
    removedSnapshotBytes: 0,
  };

  if (!activeBrepSource || isBrepAiCreationRoute(activeBrepSource)) {
    return { messages: [...messages], diagnostics };
  }

  diagnostics.applied = true;
  const projected: AppUIMessage[] = [];

  for (const message of messages) {
    if (message.role !== 'assistant') {
      // Preserve user intent, including the current leaf turn, byte-for-byte at
      // the UI-message layer. Image projection belongs to C4, not C3.
      projected.push(message);
      continue;
    }

    const parts: AppUIMessage['parts'] = [];
    for (const part of message.parts) {
      if (part.type === 'data-brep-project') {
        diagnostics.removedBrepSnapshotParts += 1;
        diagnostics.removedSnapshotBytes += jsonBytes(part.data);
        continue;
      }

      if (part.type === 'tool-build_brep_project') {
        diagnostics.removedBuildToolParts += 1;
        if ('input' in part && part.input !== undefined) {
          diagnostics.removedBuildInputBytes += jsonBytes(part.input);
        }
        if ('output' in part && part.output !== undefined) {
          diagnostics.removedBuildOutputBytes += jsonBytes(part.output);
        }

        const summary = compactAcceptedBuildSummary(part);
        if (summary) {
          parts.push({ type: 'text', text: summary });
          diagnostics.summarizedAcceptedBuilds += 1;
        }
        continue;
      }

      parts.push(part);
    }

    // A source-only assistant message (for example an imported canonical
    // revision) contributes no additional provider intent once the current
    // canonical source is injected separately, so omit an empty shell.
    if (parts.length > 0) projected.push({ ...message, parts });
  }

  diagnostics.outputMessageCount = projected.length;
  return { messages: projected, diagnostics };
}
