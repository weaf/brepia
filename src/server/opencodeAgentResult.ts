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
 *      ` ```json ` / ` ``` ` block.
 *   2. A fenced OpenSCAD block (` ```scad ` / ` ```openscad ` / bare
 *      ` ``` `) whose contents are treated as the code.
 *   3. Plain prose with no fenced block or JSON -> `code` is undefined;
 *      the trimmed text becomes `message`.  Prose mentioning OpenSCAD
 *      keywords is NOT code and must never produce a build tool-call.
 */
import crypto from 'node:crypto';
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';

/**
 * The canonical agent-output contract — the single source of truth for how
 * OpenCode / Codex / CLI agents must format their FINAL result.
 *
 * Both transports (CLI and Streaming) append this contract to the prompt
 * before sending to the model.  It tells the model exactly what JSON shape
 * to produce and why, without the contradictions that existed before R3:
 *
 *   - No "answer in plain text" directive
 *   - No "ignore all tool instructions" blanket
 *   - Clear {code, message} schema with CAD vs non-CAD distinction
 *
 * This helper is the ONLY place the contract text is defined.
 * Changing it here updates both transports in R3C/R3D.
 *
 * The helper is imported by the transport adapters in R3C/R3D and appended
 * as a final instruction line after the prompt body.
 */
export function buildAgentOutputContract(): string {
  return [
    'Final result format — return ONLY a JSON object with these keys:',
    '',
    '  {"code":"complete runnable OpenSCAD source or empty string",',
    '   "message":"short user-facing status"}',
    '',
    'For a CAD build/edit/fix request:',
    '  - code = complete, runnable OpenSCAD program',
    '  - message = short status (e.g. "Box with bottom created")',
    '',
    'For non-CAD / conversational requests:',
    '  - code = "" (empty string)',
    '  - message = normal answer',
    '',
    'Constraints:',
    '  - Do NOT use OpenCode filesystem, shell, network, web, or external tools.',
    '  - Work only from the supplied conversation context.',
    "  - Do NOT call pCAD's build_parametric_model tool directly — pCAD will",
    '    convert a non-empty `code` into build_parametric_model itself.',
  ].join('\n');
}

export type AgentResult = { code?: string; message: string };

export function parseAgentResult(text: string): AgentResult {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1] ?? text;
  try {
    const parsed = JSON.parse(fenced.trim()) as {
      code?: unknown;
      message?: unknown;
    };
    const code =
      typeof parsed.code === 'string' && parsed.code.trim()
        ? parsed.code.trim()
        : undefined;
    return {
      code,
      message: typeof parsed.message === 'string' ? parsed.message : '',
    };
  } catch {
    const code = /```(?:scad|openscad)?\s*([\s\S]*?)```/i
      .exec(text)?.[1]
      ?.trim();
    return { code, message: code ? 'Model generated.' : text.trim() };
  }
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
 * a `finish` part with `finishReason: 'tool-calls'`.  Otherwise return the
 * original finish part unchanged.  Must only be called with the COMPLETE
 * final result — never on partial fragments (R05/R06 regression contract).
 */
export function finishWithParametricToolCall(
  accumulated: string,
  finishPart: Extract<LanguageModelV2StreamPart, { type: 'finish' }>,
): LanguageModelV2StreamPart[] {
  const input = parametricBuildInput(accumulated);
  if (!input) return [finishPart];
  return [
    {
      type: 'tool-call',
      toolCallId: `stream-${crypto.randomUUID()}`,
      toolName: 'build_parametric_model',
      input: JSON.stringify(input),
    },
    { ...finishPart, finishReason: 'tool-calls' },
  ] as LanguageModelV2StreamPart[];
}
