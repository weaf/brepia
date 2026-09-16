import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { brepAiBuildProviderInputSchema } from '@shared/brepAiTool';
import { buildAgentOutputContract } from '../src/server/opencodeAgentResult';
import { buildExternalAgentSchemaContext } from '../src/server/externalAgentSchemaContext';

function embeddedSchema(context: string): unknown {
  const lines = context.split('\n');
  const json = lines.at(-2);
  assert.ok(json, 'expected one serialized schema line before the closing tag');
  return JSON.parse(json) as unknown;
}

function providerProjectSchema(): unknown {
  const schema = brepAiBuildProviderInputSchema.jsonSchema as {
    properties?: Record<string, unknown>;
  };
  const project = schema.properties?.project;
  assert.ok(project, 'expected provider build input schema to expose project');
  return project;
}

describe('external Native BRep schema context', () => {
  it('serializes the exact provider-facing canonical project schema without the internal tool wrapper', () => {
    const context = buildExternalAgentSchemaContext('brep');

    assert.match(context, /authoritative canonical Native BRep project JSON Schema/i);
    assert.match(context, /not a tool-call schema/i);
    assert.match(context, /Do not search the repository, filesystem/i);
    assert.deepEqual(embeddedSchema(context), providerProjectSchema());
    assert.notDeepEqual(
      embeddedSchema(context),
      brepAiBuildProviderInputSchema.jsonSchema,
    );
    assert.equal(buildExternalAgentSchemaContext('openscad'), '');
  });

  it('embeds the authoritative schema in the shared external-agent BRep contract only', () => {
    const brepContract = buildAgentOutputContract('brep');

    assert.match(brepContract, /<pcad_brep_schema>/);
    assert.match(brepContract, /"rectangularPattern"/);
    assert.match(brepContract, /"circularPattern"/);
    assert.match(brepContract, /"fillet"/);
    assert.match(brepContract, /Do not search for a different schema/);
    assert.doesNotMatch(buildAgentOutputContract(), /<pcad_brep_schema>/);
  });
});
