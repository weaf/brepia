import { describe, expect, it } from 'vitest';
import {
  getOpenScadEntrypoint,
  replaceOpenScadProjectFileContent,
  type OpenScadProject,
} from '@shared/openScadProject';
import {
  collectSuccessfulParametricBuilds,
  type ConversationMessageRow,
} from '../src/server/conversationWorkspaceModels';

const SHA = 'a'.repeat(64);
const ASSISTANT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ENTRYPOINT_PATH = 'src/main.scad';
const ORIGINAL_CODE = 'width = 20;\ninclude <lib/body.scad>;\nbody(width);\n';
const AUTHORED_CODE = 'width = 35;\ninclude <lib/body.scad>;\nbody(width);\n';
const PARAMETER_EDITED_CODE =
  'width = 42;\ninclude <lib/body.scad>;\nbody(width);\n';
const SUPPORT_CODE = 'module body(size) { cube([size, size, size]); }\n';

function project(entrypointContent: string): OpenScadProject {
  return {
    schemaVersion: 1,
    entrypointPath: ENTRYPOINT_PATH,
    files: [
      { path: 'src/lib/body.scad', content: SUPPORT_CODE },
      { path: ENTRYPOINT_PATH, content: entrypointContent },
    ],
    assets: [
      {
        path: 'src/assets/marker.stl',
        storagePath: `user/conversation/${SHA}.stl`,
        mediaType: 'model/stl',
        byteLength: 128,
        sha256: SHA,
      },
    ],
  };
}

function row(
  entrypointContent: string,
  originalCode?: string,
): ConversationMessageRow {
  return {
    id: ASSISTANT_ID,
    parent_message_id: null,
    created_at: '2026-09-04T21:30:00.000Z',
    role: 'assistant',
    metadata: originalCode ? { originalCode } : {},
    parts: [
      {
        type: 'tool-build_parametric_model',
        toolCallId: 'tool-call-entrypoint-edit',
        state: 'output-available',
        input: {
          title: 'Editable project',
          version: 'v1',
          project: project(entrypointContent),
        },
        output: {
          status: 'success',
          message: 'Compilation successful.',
        },
      },
    ],
  };
}

describe('direct OpenSCAD entrypoint editing', () => {
  it('replaces only the entrypoint content while preserving the complete project snapshot', () => {
    const original = project(ORIGINAL_CODE);
    const updated = replaceOpenScadProjectFileContent(
      original,
      ENTRYPOINT_PATH,
      AUTHORED_CODE,
    );

    expect(updated.entrypointPath).toBe(ENTRYPOINT_PATH);
    expect(getOpenScadEntrypoint(updated).content).toBe(AUTHORED_CODE);
    expect(updated.files.find((file) => file.path === 'src/lib/body.scad')).toEqual(
      { path: 'src/lib/body.scad', content: SUPPORT_CODE },
    );
    expect(updated.assets).toEqual(original.assets);
  });

  it('treats a directly authored entrypoint as the new parameter baseline', () => {
    const builds = collectSuccessfulParametricBuilds(
      [row(AUTHORED_CODE, AUTHORED_CODE)],
      ASSISTANT_ID,
    );

    expect(builds).toHaveLength(1);
    expect(builds[0]?.source).toBe('build');
    expect(getOpenScadEntrypoint(builds[0]!.project).content).toBe(AUTHORED_CODE);
    expect(builds[0]?.project.entrypointPath).toBe(ENTRYPOINT_PATH);
    expect(builds[0]?.project.assets).toEqual(project(AUTHORED_CODE).assets);
  });

  it('preserves the authored baseline when a later parameter control edits the entrypoint', () => {
    const builds = collectSuccessfulParametricBuilds(
      [row(PARAMETER_EDITED_CODE, AUTHORED_CODE)],
      ASSISTANT_ID,
    );

    expect(builds).toHaveLength(2);
    expect(builds.map((build) => build.source)).toEqual([
      'build',
      'parameter-edit',
    ]);
    expect(getOpenScadEntrypoint(builds[0]!.project).content).toBe(AUTHORED_CODE);
    expect(getOpenScadEntrypoint(builds[1]!.project).content).toBe(
      PARAMETER_EDITED_CODE,
    );
    for (const build of builds) {
      expect(
        build.project.files.find((file) => file.path === 'src/lib/body.scad'),
      ).toEqual({ path: 'src/lib/body.scad', content: SUPPORT_CODE });
      expect(build.project.assets).toEqual(project(AUTHORED_CODE).assets);
      expect(build.project.entrypointPath).toBe(ENTRYPOINT_PATH);
    }
  });
});
