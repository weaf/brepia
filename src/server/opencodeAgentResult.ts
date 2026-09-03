/**
 * Shared final-result parser for OpenCode/Codex agent responses.
 *
 * This is the ONLY place that interprets a completed agent response into
 * Brepia's structured Parametric artifact and user-facing message. Both
 * transports call `parseAgentResult`, so CLI and Streaming emit identical
 * Parametric tool-calls from the same output.
 */
import crypto from 'node:crypto';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { normalizeBrepAiProjectCandidate } from '@shared/brepAiProject';
import type { BrepProject } from '@shared/brepProject';
import {
  normalizeOpenScadProject,
  type OpenScadProject,
} from '@shared/openScadProject';

export type AgentParametricSourceKind = 'openscad' | 'brep';

type AgentProject = OpenScadProject | BrepProject;

export type AgentResult<TProject extends AgentProject = OpenScadProject> = {
  project?: TProject;
  message: string;
};

/**
 * Canonical machine-readable contract between external agents and Brepia.
 * Behavioral and environment instructions live in editable transport profiles;
 * this contract only defines the response protocol Brepia must be able to parse.
 *
 * OpenSCAD remains the default to preserve the historical external-agent
 * protocol. Native BRep callers opt in explicitly.
 */
export function buildAgentOutputContract(
  sourceKind: AgentParametricSourceKind = 'openscad',
): string {
  if (sourceKind === 'brep') {
    return [
      'Final result format — return ONLY one valid JSON object.',
      '',
      'When returning a revised native BRep artifact:',
      '  {"project":{"schemaVersion":1,"id":"stableProjectId","name":"...","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[],"resultNodeId":"..."},"message":"short user-facing status"}',
      '',
      'When no CAD artifact is returned:',
      '  {"message":"user-facing response"}',
      '',
      'The object must be valid JSON. Escape line breaks and other control',
      'characters inside JSON strings rather than returning raw control characters.',
      '',
      'Brepia native BRep project protocol:',
      '  - project is the COMPLETE canonical BRep project snapshot, not a patch.',
      '  - Preserve the existing project id on follow-up edits.',
      '  - Preserve every unchanged node id and published-parameter id.',
      '  - Use only node/selector forms represented by the supplied BRep schema/context.',
      '  - Never invent raw edge/face indices, OCCT identifiers, viewer triangle ids, or other topology shortcuts.',
      '  - Never return build123d/Python source, STEP, tessellation, viewer meshes, or runtime geometry as editable source.',
      '  - If <user_request> asks for a CAD change, project MUST be present.',
      '',
      'Brepia converts project into build_brep_project itself; do not wait for',
      'a native Brepia tool call inside the external transport.',
    ].join('\n');
  }

  return [
    'Final result format — return ONLY one valid JSON object.',
    '',
    'When returning a new or revised CAD artifact:',
    '  {"project":{"schemaVersion":1,"entrypointPath":"main.scad","files":[{"path":"main.scad","content":"..."}]},"message":"short user-facing status"}',
    '',
    'When no CAD artifact is returned:',
    '  {"message":"user-facing response"}',
    '',
    'The object must be valid JSON. Escape line breaks and other control',
    'characters inside JSON strings rather than returning raw control characters.',
    '',
    'Brepia Parametric project protocol:',
    '  - project is the COMPLETE normalized OpenSCAD project snapshot, not a patch.',
    '  - Preserve every unchanged support file from <current_pcad_artifact>.',
    '  - Change only files needed for the requested modification.',
    '  - Keep entrypointPath stable unless restructuring is genuinely required.',
    '  - Every path must be a relative .scad path; never return absolute or traversal paths.',
    '  - Never omit a support file that the returned source requires.',
    '  - If <user_request> asks for CAD and <pcad_build_result> is absent, project MUST be present.',
    '  - After <pcad_build_result>, omit project only when no revised CAD artifact is needed.',
    '',
    'Do not return a legacy top-level code field or an <openscad> wrapper.',
    'Brepia converts project into build_parametric_model itself; do not wait for',
    'a native Brepia tool call inside the external transport.',
  ].join('\n');
}

type StructuredAgentResultMatch<TProject extends AgentProject> = {
  end: number;
  result: AgentResult<TProject>;
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

function normalizeAgentProject(
  value: unknown,
  sourceKind: AgentParametricSourceKind,
): AgentProject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  try {
    return sourceKind === 'brep'
      ? normalizeBrepAiProjectCandidate(value)
      : normalizeOpenScadProject(value as OpenScadProject);
  } catch {
    return undefined;
  }
}

function structuredAgentResultMatches(
  text: string,
  sourceKind: AgentParametricSourceKind,
): StructuredAgentResultMatch<AgentProject>[] {
  const matches: StructuredAgentResultMatch<AgentProject>[] = [];
  const candidateStarts = [
    ...text.matchAll(/\{\s*"(?:project|message)"\s*:/g),
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
        !Object.prototype.hasOwnProperty.call(parsed, 'project') &&
        !Object.prototype.hasOwnProperty.call(parsed, 'message')
      ) {
        break;
      }

      matches.push({
        start,
        end: end + 1,
        result: {
          project: normalizeAgentProject(parsed.project, sourceKind),
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
): AgentResult<OpenScadProject> | undefined;
export function parseStructuredAgentResult(
  text: string,
  sourceKind: 'openscad',
): AgentResult<OpenScadProject> | undefined;
export function parseStructuredAgentResult(
  text: string,
  sourceKind: 'brep',
): AgentResult<BrepProject> | undefined;
export function parseStructuredAgentResult(
  text: string,
  sourceKind: AgentParametricSourceKind = 'openscad',
): AgentResult<AgentProject> | undefined {
  return structuredAgentResultMatches(text, sourceKind).at(-1)?.result;
}

export function stripStructuredAgentResults(
  text: string,
  sourceKind: AgentParametricSourceKind = 'openscad',
): string {
  let stripped = text;
  for (const match of structuredAgentResultMatches(text, sourceKind).reverse()) {
    stripped = stripped.slice(0, match.start) + stripped.slice(match.end);
  }
  return stripped.replace(/```(?:json)?\s*```/gi, '').trim();
}

export function resolveAgentResultChannels(
  text: string,
  reasoning: string,
  sourceKind: AgentParametricSourceKind = 'openscad',
): { reasoningText: string; resultText: string } {
  const textResult = parseStructuredAgentResultForKind(text, sourceKind);
  const reasoningResult = parseStructuredAgentResultForKind(
    reasoning,
    sourceKind,
  );
  return {
    resultText: textResult ? text : reasoningResult ? reasoning : text,
    reasoningText: stripStructuredAgentResults(reasoning, sourceKind),
  };
}

function parseStructuredAgentResultForKind(
  text: string,
  sourceKind: AgentParametricSourceKind,
): AgentResult<AgentProject> | undefined {
  return structuredAgentResultMatches(text, sourceKind).at(-1)?.result;
}

export function parseAgentResult(text: string): AgentResult<OpenScadProject>;
export function parseAgentResult(
  text: string,
  sourceKind: 'openscad',
): AgentResult<OpenScadProject>;
export function parseAgentResult(
  text: string,
  sourceKind: 'brep',
): AgentResult<BrepProject>;
export function parseAgentResult(
  text: string,
  sourceKind: AgentParametricSourceKind = 'openscad',
): AgentResult<AgentProject> {
  const structured = parseStructuredAgentResultForKind(text, sourceKind);
  if (structured) return structured;
  return { message: text.trim() };
}

export type ParametricBuildInput<TProject extends AgentProject = OpenScadProject> = {
  title: string;
  version: string;
  project: TProject;
  message: string;
};

export function parametricBuildInput(
  text: string,
): ParametricBuildInput<OpenScadProject> | undefined;
export function parametricBuildInput(
  text: string,
  sourceKind: 'openscad',
): ParametricBuildInput<OpenScadProject> | undefined;
export function parametricBuildInput(
  text: string,
  sourceKind: 'brep',
): ParametricBuildInput<BrepProject> | undefined;
export function parametricBuildInput(
  text: string,
  sourceKind: AgentParametricSourceKind = 'openscad',
): ParametricBuildInput<AgentProject> | undefined {
  const result = parseAgentResultForKind(text, sourceKind);
  if (!result.project) return undefined;
  return {
    title:
      sourceKind === 'brep'
        ? (result.project as BrepProject).name
        : 'Generated model',
    version: 'v1',
    project: result.project,
    message: result.message || 'Model generated.',
  };
}

function parseAgentResultForKind(
  text: string,
  sourceKind: AgentParametricSourceKind,
): AgentResult<AgentProject> {
  const structured = parseStructuredAgentResultForKind(text, sourceKind);
  return structured ?? { message: text.trim() };
}

export function finishWithParametricToolCall(
  accumulated: string,
  finishPart: Extract<LanguageModelV3StreamPart, { type: 'finish' }>,
  sourceKind: AgentParametricSourceKind = 'openscad',
): LanguageModelV3StreamPart[] {
  const input = parametricBuildInputForKind(accumulated, sourceKind);
  if (!input) return [finishPart];
  return [
    {
      type: 'tool-call',
      toolCallId: `stream-${crypto.randomUUID()}`,
      toolName:
        sourceKind === 'brep' ? 'build_brep_project' : 'build_parametric_model',
      input: JSON.stringify(input),
    },
    {
      ...finishPart,
      finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
    },
  ];
}

function parametricBuildInputForKind(
  text: string,
  sourceKind: AgentParametricSourceKind,
): ParametricBuildInput<AgentProject> | undefined {
  const result = parseAgentResultForKind(text, sourceKind);
  if (!result.project) return undefined;
  return {
    title:
      sourceKind === 'brep'
        ? (result.project as BrepProject).name
        : 'Generated model',
    version: 'v1',
    project: result.project,
    message: result.message || 'Model generated.',
  };
}
