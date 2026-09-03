import { describe, expect, it } from 'vitest';
import type { OpenScadProject } from '@shared/openScadProject';
import { getOpenScadCompletionContext } from './openScadEditor';

const project: OpenScadProject = {
  schemaVersion: 1,
  entrypointPath: 'main.scad',
  files: [
    {
      path: 'main.scad',
      content: 'include <lib/fastener.scad>\nassembly();',
    },
    {
      path: 'lib/fastener.scad',
      content: 'module assembly() { bolt(); }\nfunction pitch() = 2;',
    },
    {
      path: 'lib/shapes.scad',
      content: 'module rounded_box() { cube([1, 1, 1]); }',
    },
  ],
};

describe('getOpenScadCompletionContext', () => {
  it('suggests OpenSCAD built-ins for a typed prefix', () => {
    const source = 'tra';
    const result = getOpenScadCompletionContext({
      source,
      cursor: source.length,
    });

    expect(result.from).toBe(0);
    expect(result.options.some((option) => option.label === 'translate')).toBe(
      true,
    );
  });

  it('discovers project-defined modules and functions', () => {
    const source = 'ass';
    const result = getOpenScadCompletionContext({
      source,
      cursor: source.length,
      project,
    });

    expect(result.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'assembly',
          kind: 'module',
        }),
      ]),
    );
  });

  it('suggests project source paths inside include/use angle brackets', () => {
    const source = 'include <lib/f';
    const result = getOpenScadCompletionContext({
      source,
      cursor: source.length,
      project,
      currentPath: 'main.scad',
    });

    expect(source.slice(result.from, result.to)).toBe('lib/f');
    expect(result.options).toEqual([
      expect.objectContaining({
        label: 'lib/fastener.scad',
        kind: 'file',
      }),
    ]);
  });

  it('keeps automatic completion quiet for a one-character prefix', () => {
    const result = getOpenScadCompletionContext({
      source: 'c',
      cursor: 1,
    });

    expect(result.options).toEqual([]);
  });

  it('allows explicit completion with Ctrl+Space semantics', () => {
    const result = getOpenScadCompletionContext({
      source: '',
      cursor: 0,
      explicit: true,
      project,
    });

    expect(result.options.length).toBeGreaterThan(0);
  });
});
