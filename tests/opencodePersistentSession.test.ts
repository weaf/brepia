import assert from 'node:assert/strict';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import { afterEach, describe, it, vi } from 'vitest';
import {
  buildOpenCodeSessionId,
  buildOpenCodeSessionIdentity,
  buildPersistentOpenCodePrompt,
  ensureOpenCodeSession,
  formatPrompt,
} from '../src/server/opencode';
import { phaseOneCabinetProject } from '../shared/brepSamples';

function project(code: string, support = 'module support_part() { cube(1); }') {
  return {
    schemaVersion: 1 as const,
    entrypointPath: 'main.scad',
    files: [
      { path: 'main.scad', content: code },
      { path: 'lib/support.scad', content: support },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistent OpenCode sessions', () => {
  it('includes explicit BRep authority in non-persistent OpenCode prompts', () => {
    const text = formatPrompt(
      [{ role: 'user', content: [{ type: 'text', text: 'Make it wider' }] }],
      '',
      'brep',
      phaseOneCabinetProject,
    );

    assert.match(text, /<current_brep_project>/);
    assert.match(text, new RegExp(`"id":"${phaseOneCabinetProject.id}"`));
    assert.match(text, /build_brep_project/);
    assert.doesNotMatch(text, /build_parametric_model/);
  });

  it('derives one stable session id from a pCAD conversation', () => {
    assert.equal(
      buildOpenCodeSessionId('123e4567-e89b-12d3-a456-426614174000'),
      'ses_pcad_123e4567e89b12d3a456426614174000',
    );
  });

  it('sends the current OpenSCAD artifact and build feedback on continuation', () => {
    const prompt = [
      { role: 'system', content: 'CAD context' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Make the lid thicker' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'build_parametric_model',
            input: JSON.stringify({
              title: 'Box',
              version: 'v1',
              project: project(
                'width = 40;\nheight = 20;\ncube([width, width, height]);',
              ),
            }),
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'build_parametric_model',
            output: { type: 'text', value: 'Compiled successfully.' },
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    const reused = buildPersistentOpenCodePrompt(prompt, false);
    assert.match(reused, /<current_pcad_artifact>/);
    assert.match(reused, /width = 40;/);
    assert.match(reused, /lib\/support\.scad/);
    assert.match(reused, /module support_part/);
    assert.match(reused, /"entrypointPath":"main.scad"/);
    assert.doesNotMatch(reused, /<current_pcad_artifact>\n<openscad>/);
    assert.match(reused, /Compiled successfully/);
    assert.equal(reused.includes('<user_request>\n'), false);

    const recreated = buildPersistentOpenCodePrompt(prompt, true);
    assert.match(recreated, /<user_request>\s*Make the lid thicker/);
  });

  it('sends the exact current BRep project on every streaming continuation without OpenSCAD artifacts', () => {
    const prompt = [
      { role: 'system', content: 'BRep context' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Increase the cable hole' }],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'brep-call',
            toolName: 'build_brep_project',
            output: { type: 'text', value: 'Native BRep revision accepted.' },
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    const text = buildPersistentOpenCodePrompt(prompt, false, '', {
      sourceKind: 'brep',
      currentBrepProject: phaseOneCabinetProject,
    });

    assert.match(text, /<current_brep_project>/);
    assert.match(text, new RegExp(`"id":"${phaseOneCabinetProject.id}"`));
    assert.match(text, /Native BRep revision accepted/);
    assert.match(text, /build_brep_project/);
    assert.doesNotMatch(text, /current_pcad_artifact/);
  });

  it('uses the latest complete artifact instead of the original import on a later edit', () => {
    const originalCode =
      'width = 20;\nheight = 10;\ncube([width, width, height]);';
    const latestCode =
      'width = 36;\nheight = 14;\ncube([width, width, height]);';
    const prompt = [
      { role: 'system', content: 'CAD context' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool_import_1',
            toolName: 'build_parametric_model',
            input: {
              title: 'Imported box',
              version: 'v1',
              project: project(originalCode),
            },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Make it wider' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'build_parametric_model',
            input: {
              title: 'Imported box',
              version: 'v1',
              project: project(
                latestCode,
                'module support_part() { sphere(r = 7); }',
              ),
            },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Make it taller too' }],
      },
    ] as unknown as LanguageModelV3Prompt;

    const turnPrompt = buildPersistentOpenCodePrompt(prompt, false);
    assert.match(turnPrompt, /<current_pcad_artifact>/);
    assert.match(turnPrompt, /width = 36;/);
    assert.match(turnPrompt, /height = 14;/);
    assert.match(turnPrompt, /sphere\(r = 7\)/);
    assert.match(turnPrompt, /lib\/support\.scad/);
    assert.equal(turnPrompt.includes('width = 20;'), false);
  });

  it('keeps fourth-turn streaming context on the immediately preceding artifact', () => {
    const codes = [
      'revision = 1;\ncube([10,10,10]);',
      'revision = 2;\ncube([20,10,10]);',
      'revision = 3;\ncube([20,20,10]);',
      'revision = 4;\ncube([20,20,20]);',
    ];
    const prompt = [
      { role: 'system', content: 'CAD context' },
      { role: 'user', content: [{ type: 'text', text: 'Turn 1: make a box' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'build_parametric_model',
            input: { title: 'Box', version: 'v1', project: project(codes[0]) },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'build_parametric_model',
            output: { type: 'text', value: 'turn 1 compiled' },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Turn 2: make it wider' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'build_parametric_model',
            input: { title: 'Box', version: 'v1', project: project(codes[1]) },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'build_parametric_model',
            output: { type: 'text', value: 'turn 2 compiled' },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Turn 3: make it deeper' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-3',
            toolName: 'build_parametric_model',
            input: { title: 'Box', version: 'v1', project: project(codes[2]) },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-3',
            toolName: 'build_parametric_model',
            output: { type: 'text', value: 'turn 3 compiled' },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Turn 4: make it taller' }],
      },
    ] as unknown as LanguageModelV3Prompt;

    const fourthTurn = buildPersistentOpenCodePrompt(prompt, false);
    assert.match(fourthTurn, /revision = 3;/);
    assert.doesNotMatch(fourthTurn, /revision = 1;/);
    assert.doesNotMatch(fourthTurn, /revision = 2;/);
    assert.match(fourthTurn, /<user_request>\s*Turn 4: make it taller/);

    const continuation = [
      ...prompt,
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-4',
            toolName: 'build_parametric_model',
            input: { title: 'Box', version: 'v1', project: project(codes[3]) },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-4',
            toolName: 'build_parametric_model',
            output: { type: 'text', value: 'turn 4 compiled' },
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    const fourthContinuation = buildPersistentOpenCodePrompt(
      continuation,
      false,
    );
    assert.match(fourthContinuation, /revision = 4;/);
    assert.match(fourthContinuation, /turn 4 compiled/);
    assert.equal(fourthContinuation.includes('<user_request>\n'), false);
  });

  it('switches model in place instead of creating another session', async () => {
    const conversationId = '123e4567-e89b-12d3-a456-426614174000';
    const sessionId = buildOpenCodeSessionId(conversationId);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: sessionId,
              agent: 'pcad-builder',
              model: {
                providerID: 'llama-swap',
                id: 'qwen3.6-35b-mtp-128k',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const identity = buildOpenCodeSessionIdentity(
      'opencode/big-pickle',
      '\n\nUser: Improve the existing box',
    );
    const result = await ensureOpenCodeSession(
      'http://127.0.0.1:4096',
      identity,
      conversationId,
      new AbortController().signal,
    );

    assert.equal(result.sessionId, sessionId);
    assert.equal(result.created, false);
    assert.equal(fetchMock.mock.calls.length, 2);
    assert.equal(
      fetchMock.mock.calls[1]?.[0],
      `http://127.0.0.1:4096/api/session/${sessionId}/model`,
    );
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    assert.deepEqual(JSON.parse(String(init.body)), {
      model: { providerID: 'opencode', id: 'big-pickle' },
    });
  });
});
