import type { AppUIMessage, BrepProjectArtifactData } from '@shared/chatAi';
import {
  brepAiBuildInputSchema,
  brepAiBuildOutputSchema,
  type BrepAiBuildInput,
  type BrepAiBuildOutput,
} from '@shared/brepAiTool';
import {
  validateBrepAiCreation,
  validateBrepAiFollowUp,
  type BrepProjectStructuralDiff,
} from '@shared/brepAiProject';
import {
  isBrepAiCreationRoute,
  type BrepAiSourceRevision,
} from '@shared/brepAiContext';
import { createBrepProjectArtifact } from '@shared/brepProjectArtifact';
import { renderInstructionTemplate } from '@shared/aiInstructionCatalog';
import { serializeBrepAiProjectContext } from '@shared/brepAiContext';

const DEFAULT_BREP_CREATION_CONTEXT = `This turn was explicitly routed by the product to create a new native BRep project. No previous BRep project exists. Ignore OpenSCAD-specific creation instructions for this turn and return one complete canonical native BRep project through build_brep_project. Do not fabricate previous-project state, emit OpenSCAD/Python/build123d source, STEP, mesh/tessellation authority, filesystem paths, or raw topology indices. Use only the canonical BRep schema and supported semantic selectors.`;

export type ParametricBuildToolName =
  | 'build_parametric_model'
  | 'build_brep_project';

export type FinalizedBrepAiAssistant = {
  parts: AppUIMessage['parts'];
  artifact?: BrepProjectArtifactData;
  diff?: BrepProjectStructuralDiff;
};

export function parametricBuildToolName(
  activeBrepSource: BrepAiSourceRevision | undefined,
): ParametricBuildToolName {
  return activeBrepSource ? 'build_brep_project' : 'build_parametric_model';
}

export function withBrepProjectSystemContext({
  systemPrompt,
  contextTemplate,
  creationContext,
  activeBrepSource,
}: {
  systemPrompt: string;
  contextTemplate: string;
  creationContext?: string;
  activeBrepSource: BrepAiSourceRevision | undefined;
}): string {
  if (!activeBrepSource) return systemPrompt;
  if (isBrepAiCreationRoute(activeBrepSource)) {
    const context = creationContext?.trim() || DEFAULT_BREP_CREATION_CONTEXT;
    return `${systemPrompt.trim()}\n\n${context}`;
  }
  const context = renderInstructionTemplate(contextTemplate, {
    projectJson: serializeBrepAiProjectContext(activeBrepSource.project),
  });
  return `${systemPrompt.trim()}\n\n${context.trim()}`;
}

export function executeBrepAiBuild({
  activeBrepSource,
  input,
  onAcceptedInput,
}: {
  activeBrepSource: BrepAiSourceRevision;
  input: unknown;
  onAcceptedInput?: (input: BrepAiBuildInput) => void;
}): BrepAiBuildOutput {
  const parsed = brepAiBuildInputSchema.parse(input) as BrepAiBuildInput;
  const message = isBrepAiCreationRoute(activeBrepSource)
    ? (() => {
        validateBrepAiCreation(parsed.project);
        return 'Created canonical native BRep project.';
      })()
    : validateBrepAiFollowUp(activeBrepSource.project, parsed.project).diff
        .summary;
  const output = brepAiBuildOutputSchema.parse({
    status: 'success',
    message,
  });
  // Keep the last successfully validated candidate in request-local server
  // state. Persistence must not depend on how the AI SDK later reconstructs
  // the UI-message tool part in onFinish.
  onAcceptedInput?.(parsed);
  return output;
}

function finalSuccessfulBuildInput(
  parts: AppUIMessage['parts'],
): BrepAiBuildInput | undefined {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (
      part.type !== 'tool-build_brep_project' ||
      part.state !== 'output-available'
    ) {
      continue;
    }
    brepAiBuildOutputSchema.parse(part.output);
    return brepAiBuildInputSchema.parse(part.input) as BrepAiBuildInput;
  }
  return undefined;
}

/**
 * Revalidate the final successful BRep candidate against the exact source
 * snapshot used for generation, or as standalone canonical creation when the
 * turn was explicitly armed for first-source BRep creation. Then attach one
 * canonical data-brep-project part to the same immutable assistant response.
 * The request-local accepted candidate is authoritative when available;
 * scanning the UI message remains a compatibility fallback only. Earlier build
 * calls remain diagnostics and never become competing source revisions.
 */
export function finalizeBrepAiAssistantParts({
  parts,
  activeBrepSource,
  acceptedBuildInput,
}: {
  parts: AppUIMessage['parts'];
  activeBrepSource: BrepAiSourceRevision | undefined;
  acceptedBuildInput?: BrepAiBuildInput;
}): FinalizedBrepAiAssistant {
  if (!activeBrepSource) return { parts };

  const finalInput = acceptedBuildInput ?? finalSuccessfulBuildInput(parts);
  if (!finalInput) return { parts };

  const validation = isBrepAiCreationRoute(activeBrepSource)
    ? validateBrepAiCreation(finalInput.project)
    : validateBrepAiFollowUp(activeBrepSource.project, finalInput.project);
  const artifact = createBrepProjectArtifact({
    title: finalInput.title,
    version: finalInput.version,
    source: { kind: 'brep', source: validation.project },
  });
  const withoutPriorBrepData = parts.filter(
    (part) => part.type !== 'data-brep-project',
  ) as AppUIMessage['parts'];

  return {
    parts: [
      ...withoutPriorBrepData,
      { type: 'data-brep-project', data: artifact },
    ],
    artifact,
    ...('diff' in validation ? { diff: validation.diff } : {}),
  };
}
