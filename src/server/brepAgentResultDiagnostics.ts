import type { BrepProject } from '@shared/brepProject';
import {
  boundBrepRepairDiagnostic,
  buildExternalBrepRepairPrompt,
  externalBrepResultRepairDiagnostic,
  parseStructuredAgentResult,
  type AgentResult,
} from './opencodeAgentResult';

export {
  boundBrepRepairDiagnostic,
  MAX_BREP_REPAIR_DIAGNOSTIC_CHARS,
} from './opencodeAgentResult';

export type StructuredBrepAgentResultInspection =
  | { kind: 'missing-envelope' }
  | { kind: 'message-only'; result: AgentResult<BrepProject> }
  | {
      kind: 'invalid-project';
      result: AgentResult<BrepProject>;
      diagnostic: string;
    }
  | { kind: 'valid-project'; result: AgentResult<BrepProject> };

export function inspectStructuredBrepAgentResult(
  text: string,
): StructuredBrepAgentResultInspection {
  const result = parseStructuredAgentResult(text, 'brep');
  if (!result) return { kind: 'missing-envelope' };
  if (result.project) return { kind: 'valid-project', result };

  const diagnostic = externalBrepResultRepairDiagnostic(text);
  if (diagnostic) {
    return {
      kind: 'invalid-project',
      result,
      diagnostic: boundBrepRepairDiagnostic(diagnostic),
    };
  }
  return { kind: 'message-only', result };
}

export function boundedExternalBrepResultRepairDiagnostic(
  text: string,
  options: { requireProject?: boolean } = {},
): string | undefined {
  const diagnostic = externalBrepResultRepairDiagnostic(text, options);
  return diagnostic === undefined
    ? undefined
    : boundBrepRepairDiagnostic(diagnostic);
}

export function buildBoundedExternalBrepRepairPrompt(args: {
  diagnostic: string;
  attempt: number;
  maxAttempts: number;
}): string {
  return buildExternalBrepRepairPrompt({
    ...args,
    diagnostic: boundBrepRepairDiagnostic(args.diagnostic),
  });
}
