import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAgentResult } from './opencodeAgentResult.ts';

describe('R04B shared final-result parser (opencodeAgentResult)', () => {
  describe('code classification', () => {
    it('extracts code from a fenced ```scad block', () => {
      const result = parseAgentResult(
        'Here is the model:\n```scad\ncube([10,10,10]);\ntranslate([0,0,20]) sphere(r=5);\n```',
      );
      assert.equal(
        result.code,
        'cube([10,10,10]);\ntranslate([0,0,20]) sphere(r=5);',
      );
      assert.equal(result.message, 'Model generated.');
    });

    it('extracts code from a fenced ```openscad block', () => {
      const result = parseAgentResult('```openscad\ncylinder(h=10, r=5);\n```');
      assert.equal(result.code, 'cylinder(h=10, r=5);');
    });

    it('extracts code from a bare fenced block', () => {
      const result = parseAgentResult('```\nsphere(r=10);\n```');
      assert.equal(result.code, 'sphere(r=10);');
    });

    it('extracts code from a fenced ```json {code,message} payload', () => {
      const result = parseAgentResult(
        '```json\n{"code":"cube([5,5,5]);","message":"Model ready"}\n```',
      );
      assert.equal(result.code, 'cube([5,5,5]);');
      assert.equal(result.message, 'Model ready');
    });

    it('extracts code and message from a bare JSON payload', () => {
      const result = parseAgentResult(
        '{"code":"sphere(r=2);","message":"Done"}',
      );
      assert.equal(result.code, 'sphere(r=2);');
      assert.equal(result.message, 'Done');
    });

    it('treats empty code as no code', () => {
      const result = parseAgentResult(
        '```json\n{"code":"","message":"nothing to build"}\n```',
      );
      assert.equal(result.code, undefined);
      assert.equal(result.message, 'nothing to build');
    });
  });

  describe('parser invariant — plain prose is NOT code', () => {
    const proseExamples = [
      'The cube is already centered.',
      'Rotate the part 90 degrees before printing.',
      'I would keep the cylinder as-is.',
      'The cube is already centered. Rotate the part 90 degrees before printing.',
    ];

    for (const prose of proseExamples) {
      it(`produces no code for: "${prose}"`, () => {
        const result = parseAgentResult(prose);
        assert.equal(result.code, undefined);
        assert.equal(result.message, prose);
      });
    }

    it('produces no code for prose mentioning many primitives', () => {
      const result = parseAgentResult(
        'A cube with a sphere inside a cylinder, translated and rotated to center.',
      );
      assert.equal(result.code, undefined);
    });
  });

  describe('message behavior', () => {
    it('returns the trimmed text as message when no code', () => {
      const result = parseAgentResult('  Just a note.  ');
      assert.equal(result.message, 'Just a note.');
    });
  });
});
