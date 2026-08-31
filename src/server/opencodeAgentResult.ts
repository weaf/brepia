/**
 * Shared final-result parser for OpenCode/Codex agent responses.
 *
 * This is the ONLY place that interprets a completed agent response into
 * Brepia's structured Parametric artifact and user-facing message. Both
 * transports call `parseAgentResult`, so CLI and Streaming emit identical
 * `build_parametric_model` tool-calls from the same output.
 */
import crypto from 'node:crypto';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import {
  normalizeOpenScadProject,
  type OpenScadProject,
} from '@shared/openScadProject';

/**
 * Canonical machine-readable contract between external agents and Brepia.
 * Behavioral and environment instructions live in editable transport profiles;
 * this contract only defines the response protocol Brepia must be able to parse.
 *
 * External agents remain code-oriented at this boundary for now. Step 5 will
 * upgrade the agent protocol to author complete multi-file snapshots. Until
 * then the adapter below deterministically wraps returned code as `main.scad`.
 */
export function buildAgentOutputContract(): string {
  return [
    'Final result format — return ONLY a JSON object with these keys:',
    '',
    '  {"code":"complete runnable OpenSCAD source or empty string",',
    '   "message":"short user-facing status"}',
    '',
    'The object must be valid JSON. Escape line breaks and other control',
    'characters inside JSON strings rather than returning raw control characters.',
    '',
    'Brepia parametric turn protocol:',
    '  - If <user_request> is present and <pcad_build_result> is absent, code',
    '    MUST be non-empty and contain the complete runnable OpenSCAD program.',
    '  - code = "" is allowed after <pcad_build_result> when no revised CAD',
    '    artifact is being returned, or for an explicit non-CAD response.',
    '',
    'When returning a new or revised CAD artifact:',
    '  - code = complete, runnable OpenSCAD program',
    '  - message = short user-facing status',
    '',
    'When no CAD artifact is returned:',
    '  - code = ""',
    '  - message = the user-facing response',
    '',
    'You MUST emit this JSON final result. Brepia converts a non-empty code',
    'value into a project-native build_parametric_model call itself; do not',
    'emit or wait for a native Brepia tool call inside the external transport.',
  ].join('\n');
}

export type AgentResult = { code?: string; message: string };

type StructuredAgentResultMatch = {
  end: number;
  result: AgentResult;
  start: number;
};

function escapeRawControlCharactersInJsonStrings(value: string): string {
  let escaped = false;
  let inString = false;
  let changed = false;
  let result = '';

  for (const character of value) {
    if (!inString) {
      result += character;
      if (character === '"') inString = true;
      continue;
    }

    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      result += character;
      escaped = true;
      continue;
    }

    if (character === '"') {
      result += character;
      inString = false;
      continue;
    }

    const codePoint = character.charCodeAt(0);
    if (codePoint >= 0x20) {
      result += character;
      continue;
    }

    changed = true;
    switch (character) {
      case '\b':
        result += '\\b';
        break;
      case '\f':
        result += '\\f';
        break;
      case '\n':
        result += '\\n';
        break;
      case '\r':
        result += '\\r';
        break;
      case '\t':
        result += '\\t';
        break;
      default:
        result += `\\u${codePoint.toString(16).padStart(4, '0')}`;
        break;
    }
  }

  return changed ? result : value;
}

function parseStructuredEnvelope(
  candidate: string,
): Record<string, unknown> | undefined {
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const normalized = escapeRawControlCharactersInJsonStrings(candidate);
    if (normalized === candidate) return undefined;
    try {
      return JSON.parse(normalized) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}

function structuredAgentResultMatches(
  text: string,
): StructuredAgentResultMatch[] {
  const matches: StructuredAgentResultMatch[] = [];
  const candidateStarts = [
    ...text.matchAll(/\{\s*"(?:code|message)"\s*:/g),
  ].flatMap((match) => (match.index === undefined ? [] : [match.index]));
  for (const start of candidateStarts) {
    let depth = 0;
    let escaped = false;
    let inString = false;
    for (let end = start; end < text.length; end += 1) {
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

      const parsed = parseStructuredEnvelope(text.slice(start, end + 1));
      if (!parsed) break;
      if (
        !Object.prototype.hasOwnProperty.call(parsed, 'code') &&
        !Object.prototype.hasOwnProperty.call(parsed, 'message')
      ) {
        break;
      }

      const code =
        typeof parsed.code === 'string' && parsed.code.trim()
          ? parsed.code.trim()
          : undefined;
      matches.push({
        start,
        end: end + 1,
        result: {
          code,
          message: typeof parsed.message === 'string' ? parsed.message : '',
        },
      });
      break;
    }
  }

  return matches;
}

export function parseStructuredAgentResult(
  text: string,
): AgentResult | undefined {
  return structuredAgentResultMatches(text).at(-1)?.result;
}

export function stripStructuredAgentResults(text: string): string {
  let stripped = text;
  for (const match of structuredAgentResultMatches(text).reverse()) {
    stripped = stripped.slice(0, match.start) + stripped.slice(match.end);
  }
  return stripped.replace(/```(?:json)?\s*```/gi, '').trim();
}

export function resolveAgentResultChannels(
  text: string,
  reasoning: string,
): { reasoningText: string; resultText: string } {
  const textResult = parseStructuredAgentResult(text);
  const reasoningResult = parseStructuredAgentResult(reasoning);
  return {
    resultText: textResult ? text : reasoningResult ? reasoning : text,
    reasoningText: stripStructuredAgentResults(reasoning),
  };
}

export function parseAgentResult(text: string): AgentResult {
  const structured = parseStructuredAgentResult(text);
  if (structured) return structured;

  const code = /```(?:scad|openscad)?\s*([\s\S]*?)```/i.exec(text)?.[1]?.trim();
  return { code, message: code ? 'Model generated.' : text.trim() };
}

export type ParametricBuildInput = {
  title: string;
  version: string;
  project: OpenScadProject;
  message: string;
};

export function parametricBuildInput(
  text: string,
): ParametricBuildInput | undefined {
  const result = parseAgentResult(text);
  if (!result.code) return undefined;
  return {
    title: 'Generated model',
    version: 'v1',
    project: normalizeOpenScadProject({
      schemaVersion: 1,
      entrypointPath: 'main.scad',
      files: [{ path: 'main.scad', content: result.code }],
    }),
    message: result.message || 'Model generated.',
  };
}

export function finishWithParametricToolCall(
  accumulated: string,
  finishPart: Extract<LanguageModelV3StreamPart, { type: 'finish' }>,
): LanguageModelV3StreamPart[] {
  const input = parametricBuildInput(accumulated);
  if (!input) return [finishPart];
  return [
    {
      type: 'tool-call',
      toolCallId: `stream-${crypto.randomUUID()}`,
      toolName: 'build_parametric_model',
      input: JSON.stringify(input),
    },
    {
      ...finishPart,
      finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
    },
  ];
}
