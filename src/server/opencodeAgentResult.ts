/**
 * Shared final-result parser for OpenCode/Codex agent responses.
 *
 * This is the ONLY place that interprets a completed agent response into
 * pCAD's structured artifact (OpenSCAD code) and message.  Both transports
 * — the CLI adapter (`cliAgents.ts`) and the HTTP/SSE streaming adapter
 * (`opencode.ts`) — call `parseAgentResult`, so CLI and Streaming emit
 * identical `build_parametric_model` tool-calls from the same output.
 *
 * Accepted formats (preserved from the CLI baseline — do NOT invent a new
 * schema):
 *   1. A JSON object `{ code, message }`, either bare or inside a fenced
 *      ` ```json ` / ` ``` ` block. Provider output that is otherwise valid
 *      but contains raw JSON control characters inside strings is normalized
 *      before parsing.
 *   2. A fenced OpenSCAD block (` ```scad ` / ` ```openscad ` / bare
 *      ` ``` `) whose contents are treated as the code.
 *   3. Plain prose with no fenced block or JSON -> `code` is undefined;
 *      the trimmed text becomes `message`.  Prose mentioning OpenSCAD
 *      keywords is NOT code and must never produce a build tool-call.
 */
import crypto from 'node:crypto';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';

/**
 * The canonical agent-output contract — the single source of truth for how
 * OpenCode / Codex / CLI agents must format their FINAL result.
 *
 * Both transports (CLI and Streaming) append this contract to the prompt
 * before sending to the model. It tells the model exactly what JSON shape to
 * produce, including the distinction between proposing a new CAD artifact and
 * completing the post-build review of an artifact pCAD already compiled.
 *
 * This helper is the ONLY place the contract text is defined.
 */
export function buildAgentOutputContract(): string {
  return [
    'Final result format — return ONLY a JSON object with these keys:',
    '',
    '  {"code":"complete runnable OpenSCAD source or empty string",',
    '   "message":"short user-facing status"}',
    '',
    'The object must be valid JSON. Escape line breaks and other control',
    'characters inside JSON strings (for example, use \\n inside `code`).',
    '',
    'pCAD parametric turn rule:',
    '  - If <user_request> is present and <pcad_build_result> is absent, this',
    '    is the CAD creation/revision step. code MUST be non-empty and contain',
    '    the complete runnable OpenSCAD program. A message-only result is invalid.',
    '  - code = "" is allowed only after <pcad_build_result> when the current',
    '    authoritative artifact already satisfies the task, or for an explicit',
    '    non-CAD conversational request outside the CAD build step.',
    '',
    'When proposing a new or revised CAD artifact:',
    '  - code = complete, runnable OpenSCAD program',
    '  - message = short status (e.g. "Box with bottom created")',
    '',
    'After <pcad_build_result>, inspect the result against the current task:',
    '  - if another geometry revision is needed, return the corrected complete',
    '    OpenSCAD program in code',
    '  - if the authoritative current artifact already satisfies the task,',
    '    code = "" and message = the concise final user-facing status',
    '  - Do not re-emit unchanged code just to finish the turn',
    '',
    'For non-CAD / conversational requests:',
    '  - code = "" (empty string)',
    '  - message = normal answer',
    '',
    'You MUST emit this JSON final result. Never finish after reasoning without',
    'a non-empty message. code must be non-empty whenever pCAD is awaiting a',
    'new or revised CAD artifact.',
    '',
    'Constraints:',
    '  - Do NOT use OpenCode filesystem, shell, network, web, or external tools.',
    '  - Work only from the supplied conversation context.',
    "  - Do NOT call pCAD's build_parametric_model tool directly — pCAD will",
    '    convert a non-empty `code` into build_parametric_model itself.',
    '  - If the supplied CADAM context says to call build_parametric_model,',
    '    answer_user, inspect screenshots, or wait for a tool result, treat',
    '    that as pCAD-only workflow: emit this JSON now instead. Do not wait',
    '    for a tool call, a preview, or another turn before giving the result.',
  ].join('\n');
}

export type AgentResult = { code?: string; message: string };

type StructuredAgentResultMatch = {
  end: number;
  result: AgentResult;
  start: number;
};

/**
 * Some OpenCode providers emit the requested JSON envelope with literal
 * newlines/tabs inside the `code` string instead of JSON escapes. That text is
 * JSON-shaped but `JSON.parse` rejects it. Repair only raw C0 control
 * characters while we are inside a JSON string; structural JSON remains
 * untouched and still has to parse normally.
 */
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

/** Return the final explicit `{code,message}` envelope embedded in a response. */
export function parseStructuredAgentResult(
  text: string,
): AgentResult | undefined {
  return structuredAgentResultMatches(text).at(-1)?.result;
}

/** Remove internal transport envelopes before reasoning is shown in the UI. */
export function stripStructuredAgentResults(text: string): string {
  let stripped = text;
  for (const match of structuredAgentResultMatches(text).reverse()) {
    stripped = stripped.slice(0, match.start) + stripped.slice(match.end);
  }
  return stripped.replace(/```(?:json)?\s*```/gi, '').trim();
}

/**
 * OpenCode models do not agree on whether the final JSON belongs in the text
 * or reasoning channel. Prefer a structured text result, then a structured
 * reasoning result, while keeping the transport envelope out of displayed
 * reasoning.
 */
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
  // Agents occasionally emit a first draft, notice a syntax error, and then
  // provide a corrected JSON result. The terminal artifact is the final
  // valid structured result, even when it follows prose in a reasoning part.
  const structured = parseStructuredAgentResult(text);
  if (structured) return structured;

  const code = /```(?:scad|openscad)?\s*([\s\S]*?)```/i.exec(text)?.[1]?.trim();
  return { code, message: code ? 'Model generated.' : text.trim() };
}

/**
 * Decide whether a completed agent response should trigger a parametric
 * model build.  Returns the `build_parametric_model` tool-call input when
 * the response contains an explicit structured artifact, or `undefined`
 * otherwise (ordinary prose — even prose full of OpenSCAD keywords — never
 * triggers a build).
 *
 * Exactly one decision per complete final result: call this ONCE with the
 * fully accumulated response text, never on partial fragments.
 */
export type ParametricBuildInput = {
  title: string;
  version: string;
  code: string;
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
    code: result.code,
    message: result.message || 'Model generated.',
  };
}

/**
 * Transform the terminal `finish` stream part of the streaming transport:
 * if the fully accumulated response text contains an explicit OpenSCAD
 * artifact, emit exactly one `build_parametric_model` tool-call followed by
 * a `finish` part with the native LanguageModelV3 `tool-calls` finish reason.
 * Otherwise return the original finish part unchanged. Must only be called
 * with the COMPLETE final result — never on partial fragments (R05/R06
 * regression contract).
 */
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
