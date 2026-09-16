import { describe, expect, it } from 'vitest';
import {
  BREP_AGENT_SCHEMA_CONTEXT_TAG,
  buildExternalAgentSchemaContext,
} from '../src/server/externalAgentSchemaContext';

describe('external Native BRep schema context', () => {
  it('exposes only the canonical project grammar, not the internal build-tool input wrapper', () => {
    const context = buildExternalAgentSchemaContext('brep');
    const lines = context.split('\n');

    expect(lines[0]).toBe(`<${BREP_AGENT_SCHEMA_CONTEXT_TAG}>`);
    expect(lines.at(-1)).toBe(`</${BREP_AGENT_SCHEMA_CONTEXT_TAG}>`);
    expect(context).toContain('canonical Native BRep project JSON Schema');
    expect(context).toContain('it is not a tool-call schema');
    expect(context).not.toContain('authoritative build_brep_project input JSON Schema');

    const schema = JSON.parse(lines.at(-2) ?? '{}') as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.properties).toHaveProperty('schemaVersion');
    expect(schema.properties).toHaveProperty('id');
    expect(schema.properties).toHaveProperty('placement');
    expect(schema.properties).toHaveProperty('parameters');
    expect(schema.properties).toHaveProperty('nodes');
    expect(schema.properties).toHaveProperty('resultNodeId');
    expect(schema.properties).not.toHaveProperty('title');
    expect(schema.properties).not.toHaveProperty('version');
    expect(schema.properties).not.toHaveProperty('project');
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'id',
        'name',
        'units',
        'placement',
        'parameters',
        'nodes',
        'resultNodeId',
      ]),
    );
  });
});
