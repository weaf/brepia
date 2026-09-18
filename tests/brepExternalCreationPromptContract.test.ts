import { describe, expect, it } from 'vitest';
import { withBrepProjectSystemContext } from '../src/server/brepAiTurn';

describe('external Native BRep creation prompt contract', () => {
  it('requires the JSON envelope and explicitly forbids imitated tool-call markup', () => {
    const system = withBrepProjectSystemContext({
      systemPrompt: 'Base prompt',
      contextTemplate: '<brep>{{projectJson}}</brep>',
      activeBrepSource: { kind: 'creation', messageId: 'user-u1' },
    });

    expect(system).toContain('final-result JSON envelope');
    expect(system).toContain(
      'does not expose build_brep_project as a callable tool',
    );
    expect(system).toContain('do not emit or imitate a build_brep_project tool call');
    expect(system).toContain('<tool_call>');
    expect(system).toContain('<arg_key>');
    expect(system).toContain('<arg_value>');
    expect(system).toContain(
      'Brepia validates the JSON envelope and converts its project into build_brep_project itself',
    );
    expect(system).not.toContain(
      'return one complete canonical native BRep project through build_brep_project',
    );
  });
});
