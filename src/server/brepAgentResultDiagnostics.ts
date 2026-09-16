import type { BrepProject } from '@shared/brepProject';
import {
  boundBrepRepairDiagnostic,
  buildExternalBrepRepairPrompt,
  externalBrepResultRepairDiagnostic,
  parseStructuredAgentResult,
  type AgentResult,
} from './opencodeAgentResult';
import {
  recordActiveCanonicalCandidate,
  recordActiveExternalAgentInvocation,
} from './generationRunTelemetry';

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

type MalformedEnvelopeAttempt = {
  firstKey: 'project' | 'message';
  diagnostic: string;
};

function malformedEnvelopeAttempt(text: string): MalformedEnvelopeAttempt | undefined {
  const starts = [
    ...text.matchAll(/\{\s*"(project|message)"\s*:/g),
  ].flatMap((match) =>
    match.index === undefined
      ? []
      : [
          {
            index: match.index,
            firstKey: match[1] as 'project' | 'message',
          },
        ],
  );
  const latest = starts.at(-1);
  if (!latest) return undefined;

  let depth = 0;
  let escaped = false;
  let inString = false;
  for (let end = latest.index; end < text.length; end += 1) {
    const character = text[end];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
    }

    if (depth !== 0) continue;

    const candidate = text.slice(latest.index, end + 1);
    try {
      JSON.parse(candidate);
      return undefined;
    } catch (error) {
      const detail =
        error instanceof Error && error.message.trim()
          ? ` JSON parser: ${error.message.trim().slice(0, 300)}`
          : '';
      return {
        firstKey: latest.firstKey,
        diagnostic:
          `Native BRep result starts a structured \`${latest.firstKey}\` envelope, but the JSON is malformed.${detail} ` +
          'Correct the JSON syntax first, then return exactly one complete final-result object.',
      };
    }
  }

  return {
    firstKey: latest.firstKey,
    diagnostic:
      `Native BRep result starts a structured \`${latest.firstKey}\` envelope, but the JSON object is unterminated or has unbalanced delimiters. ` +
      'Correct the JSON syntax first, then return exactly one complete final-result object.',
  };
}

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
  const structured = parseStructuredAgentResult(text, 'brep');
  if (!structured) {
    const malformed = malformedEnvelopeAttempt(text);
    if (
      malformed &&
      (malformed.firstKey === 'project' || options.requireProject === true)
    ) {
      const diagnostic = boundBrepRepairDiagnostic(malformed.diagnostic);
      recordActiveExternalAgentInvocation();
      recordActiveCanonicalCandidate({
        accepted: false,
        errorCode: 'malformed_envelope',
        errorMessage: diagnostic,
      });
      return diagnostic;
    }
  }

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
