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

describe('external Native BRep schema context', () => {
  it('serializes the exact provider-facing build_brep_project schema', () => {
    const context = buildExternalAgentSchemaContext('brep');

    assert.match(context, /authoritative build_brep_project input JSON Schema/i);
    assert.match(context, /Do not search the repository, filesystem/i);
    assert.deepEqual(
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
