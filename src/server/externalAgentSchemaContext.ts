import { brepAiBuildProviderInputSchema } from '@shared/brepAiTool';
import type { AgentParametricSourceKind } from './opencodeAgentResult';

export const BREP_AGENT_SCHEMA_CONTEXT_TAG = 'pcad_brep_schema';

export function buildExternalAgentSchemaContext(
  sourceKind: AgentParametricSourceKind,
): string {
  if (sourceKind !== 'brep') return '';

  return [
    `<${BREP_AGENT_SCHEMA_CONTEXT_TAG}>`,
    'This is the authoritative build_brep_project input JSON Schema supplied by Brepia.',
    'Use its project property as the exact grammar for the project object in the final-result envelope.',
    'Do not search the repository, filesystem, documentation, network, or other tools to discover or infer the BRep schema.',
    JSON.stringify(brepAiBuildProviderInputSchema.jsonSchema),
    `</${BREP_AGENT_SCHEMA_CONTEXT_TAG}>`,
  ].join('\n');
}
