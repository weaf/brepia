import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { phaseOneCabinetProject } from '../shared/brepSamples';
import { streamingOpencodeChatModel } from '../src/server/opencode';

function sse(
  events: Array<{
    type: string;
    data: Record<string, unknown>;
    durable?: { seq: number };
  }>,
): string {
  return `${events
    .map((event) => `data: ${JSON.stringify(event)}`)
    .join('\n\n')}\n\n`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streaming OpenCode Native BRep repair', () => {
  it('repairs an invalid creation result in the same session and resumes from the repair cursor', async () => {
    const sessionId = 'ses_streaming_brep_repair';
    const promptBodies: Array<Record<string, unknown>> = [];
    const eventUrls: string[] = [];
    let eventCall = 0;

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/session') && method === 'POST') {
        return new Response(
          JSON.stringify({
            data: {
              id: sessionId,
              agent: 'brep-builder',
              model: { providerID: 'opencode', id: 'test-model' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.endsWith(`/api/session/${sessionId}`) && method === 'PATCH') {
        return new Response(null, { status: 204 });
      }

      if (url.endsWith(`/api/session/${sessionId}/prompt`) && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<
          string,
          unknown
        >;
        promptBodies.push(body);
        return new Response(
          JSON.stringify({
            data: { admittedSeq: promptBodies.length === 1 ? 10 : 20 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes(`/api/session/${sessionId}/event`)) {
        eventUrls.push(url);
        eventCall += 1;
        if (eventCall === 1) {
          return new Response(
            sse([
              {
                type: 'session.next.text.ended',
                data: {
                  text: JSON.stringify({
                    project: { schemaVersion: 1 },
                    message: 'invalid candidate',
                  }),
                },
                durable: { seq: 11 },
              },
              {
                type: 'session.next.step.ended',
                data: { finish: 'stop' },
                durable: { seq: 12 },
              },
            ]),
            { status: 200 },
          );
        }

        return new Response(
          sse([
            {
              type: 'session.next.text.ended',
              data: {
                text: JSON.stringify({
                  project: phaseOneCabinetProject,
                  message: 'repaired',
                }),
              },
              durable: { seq: 21 },
            },
            {
              type: 'session.next.step.ended',
              data: { finish: 'stop' },
              durable: { seq: 22 },
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith(`/api/session/${sessionId}/interrupt`)) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected OpenCode request: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const model = streamingOpencodeChatModel('opencode/test-model', undefined, {
      sourceKind: 'brep',
      validationAttempts: 2,
    });
    const response = await model.doStream({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Create a cabinet' }],
        },
      ],
      abortSignal: new AbortController().signal,
    });

    const parts: Array<Record<string, unknown>> = [];
    const reader = response.stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as unknown as Record<string, unknown>);
      }
    } finally {
      reader.releaseLock();
    }

    assert.equal(promptBodies.length, 2);
    const initialPrompt = promptBodies[0]?.['prompt'] as
      | { text?: string }
      | undefined;
    const repairPrompt = promptBodies[1]?.['prompt'] as
      | { text?: string }
      | undefined;
    assert.match(initialPrompt?.text ?? '', /Create a cabinet/);
    assert.match(repairPrompt?.text ?? '', /<pcad_brep_validation_failure>/);
    assert.match(repairPrompt?.text ?? '', /<canonical_diagnostics>/);
    assert.equal(eventUrls.length, 2);
    assert.match(eventUrls[0] ?? '', /after=10/);
    assert.match(eventUrls[1] ?? '', /after=20/);

    const toolCalls = parts.filter((part) => part['type'] === 'tool-call');
    assert.equal(toolCalls.length, 1);
    assert.equal(toolCalls[0]?.['toolName'], 'build_brep_project');
    const toolInput = JSON.parse(String(toolCalls[0]?.['input'])) as {
      project?: { id?: string };
    };
    assert.equal(toolInput.project?.id, phaseOneCabinetProject.id);
    assert.equal(
      parts.some(
        (part) =>
          part['type'] === 'text-delta' &&
          String(part['delta']).includes('invalid candidate'),
      ),
      false,
    );
  });
});
