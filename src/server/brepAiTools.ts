import { chatTools, type AppTools } from '@shared/chatAi';
import type { BrepAiSourceRevision } from '@shared/brepAiContext';
import type { BrepAiBuildInput } from '@shared/brepAiTool';
import { executeBrepAiBuild } from './brepAiTurn';

/**
 * Native BRep tools execute on the chat server because their only operation is
 * canonical snapshot validation/diffing. They never invoke OCCT/build123d.
 * `answer_user` is also server-resolved here so a BRep turn has no browser-side
 * pending tool lifecycle that could overwrite the canonical source data part.
 */
export function brepParametricTools({
  activeBrepSource,
  buildDescription,
  answerDescription,
  onAcceptedBuild,
}: {
  activeBrepSource: BrepAiSourceRevision;
  buildDescription: string;
  answerDescription: string;
  onAcceptedBuild?: (input: BrepAiBuildInput) => void;
}) {
  return {
    build_brep_project: {
      ...chatTools.build_brep_project,
      description: buildDescription,
      execute: async (input: AppTools['build_brep_project']['input']) =>
        executeBrepAiBuild({
          activeBrepSource,
          input,
          onAcceptedInput: onAcceptedBuild,
        }),
    },
    answer_user: {
      ...chatTools.answer_user,
      description: answerDescription,
      execute: async (input: AppTools['answer_user']['input']) => input,
    },
  };
}
