import type { AgentParametricSourceKind } from './opencodeAgentResult';

export const PCAD_OPENCODE_AGENT = 'pcad-builder' as const;
export const BREP_OPENCODE_AGENT = 'brep-builder' as const;

export type OpenCodeAgentName =
  | typeof PCAD_OPENCODE_AGENT
  | typeof BREP_OPENCODE_AGENT;

export function openCodeAgentForSourceKind(
  sourceKind: AgentParametricSourceKind = 'openscad',
): OpenCodeAgentName {
  return sourceKind === 'brep' ? BREP_OPENCODE_AGENT : PCAD_OPENCODE_AGENT;
}
