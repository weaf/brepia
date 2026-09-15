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

type StreamingRepairScenario = {
  eventUrls: string[];
  parts: Array<Record<string, unknown>>;
  promptBodies: Array<Record<string, unknown>>;
};

async function runStreamingRepairScenario({
  results,
  validationAttempts = 2,
}: {
  results: string[];
  validationAttempts?: number;
}): Promise<StreamingRepairScenario> {
  const conversationId = 'conversation-streaming-brep-repair';
  const sessionId = 'ses_pcad_conversationstreamingbreprepair';
  const promptBodies: Array<Record<string, unknown>> = [];
  const eventUrls: string[] = [];
  let eventCall = 0;

  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.endsWith(`/api/session/${sessionId}`) && method === 'GET') {
      return new Response(null, { status: 404 });
    }

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
        JSON.stringify({ data: { admittedSeq: promptBodies.length * 10 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes(`/api/session/${sessionId}/event`)) {
      eventUrls.push(url);
      const result = results[eventCall];
      if (result === undefined) {
        throw new Error(`Unexpected extra OpenCode event poll ${eventCall + 1}`);
      }
      eventCall += 1;
      const durableBase = eventCall * 10;
      return new Response(
        sse([
          {
            type: 'session.next.text.ended',
            data: { text: result },
            durable: { seq: durableBase + 1 },
          },
          {
            type: 'session.next.step.ended',
            data: { finish: 'stop' },
            durable: { seq: durableBase + 2 },
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

  const model = streamingOpencodeChatModel(
    'opencode/test-model',
    conversationId,
    {
      sourceKind: 'brep',
      validationAttempts,
    },
  );
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

  return { eventUrls, parts, promptBodies };
}

function promptText(
  promptBodies: Array<Record<string, unknown>>,
  index: number,
): string {
  const prompt = promptBodies[index]?.['prompt'] as
    | { text?: string }
    | undefined;
  return prompt?.text ?? '';
}

function toolCalls(parts: Array<Record<string, unknown>>) {
  return parts.filter((part) => part['type'] === 'tool-call');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streaming OpenCode Native BRep repair', () => {
  it('repairs a canonical normalization failure in the same persistent session and resumes from the repair cursor', async () => {
    const invalidProject = {
      ...phaseOneCabinetProject,
      resultNodeId: 'missingNode',
    };
    const scenario = await runStreamingRepairScenario({
      results: [
        JSON.stringify({
          project: invalidProject,
          message: 'invalid candidate',
        }),
        JSON.stringify({
          project: phaseOneCabinetProject,
          message: 'repaired',
        }),
      ],
    });

    assert.equal(scenario.promptBodies.length, 2);
    assert.match(promptText(scenario.promptBodies, 0), /Create a cabinet/);
    assert.match(
      promptText(scenario.promptBodies, 1),
      /<pcad_brep_validation_failure>/,
    );
    assert.match(
      promptText(scenario.promptBodies, 1),
      /<canonical_diagnostics>/,
    );
    assert.match(
      promptText(scenario.promptBodies, 1),
      /missingNode|resultNodeId/i,
    );
    assert.deepEqual(
      scenario.eventUrls.map((url) => new URL(url).searchParams.get('after')),
      ['10', '20'],
    );

    const calls = toolCalls(scenario.parts);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.['toolName'], 'build_brep_project');
    const toolInput = JSON.parse(String(calls[0]?.['input'])) as {
      project?: { id?: string };
    };
    assert.equal(toolInput.project?.id, phaseOneCabinetProject.id);
    assert.equal(
      scenario.parts.some(
        (part) =>
          part['type'] === 'text-delta' &&
          String(part['delta']).includes('invalid candidate'),
      ),
      false,
    );
  });

  it('repairs a missing structured envelope before synthesizing build_brep_project', async () => {
    const scenario = await runStreamingRepairScenario({
      results: [
        'This is not the required structured result.',
        JSON.stringify({
          project: phaseOneCabinetProject,
          message: 'repaired envelope',
        }),
      ],
    });

    assert.equal(scenario.promptBodies.length, 2);
    assert.match(
      promptText(scenario.promptBodies, 1),
      /one structured JSON result containing a complete `project` object/i,
    );
    assert.deepEqual(
      scenario.eventUrls.map((url) => new URL(url).searchParams.get('after')),
      ['10', '20'],
    );
    assert.equal(toolCalls(scenario.parts).length, 1);
    assert.equal(toolCalls(scenario.parts)[0]?.['toolName'], 'build_brep_project');
  });

  it('terminates after the configured retry budget when repeated invalid results never repair', async () => {
    const invalidProject = {
      ...phaseOneCabinetProject,
      resultNodeId: 'stillMissing',
    };
    const scenario = await runStreamingRepairScenario({
      validationAttempts: 2,
      results: [
        'Still not a structured result.',
        JSON.stringify({
          project: invalidProject,
          message: 'still invalid',
        }),
      ],
    });

    assert.equal(scenario.promptBodies.length, 2);
    assert.equal(scenario.eventUrls.length, 2);
    assert.deepEqual(
      scenario.eventUrls.map((url) => new URL(url).searchParams.get('after')),
      ['10', '20'],
    );
    assert.equal(toolCalls(scenario.parts).length, 0);

    const userText = scenario.parts
      .filter((part) => part['type'] === 'text-delta')
      .map((part) => String(part['delta'] ?? ''))
      .join('');
    assert.match(userText, /Native BRep validation failed after 2 attempts/i);
    assert.match(userText, /stillMissing|resultNodeId/i);
    assert.doesNotMatch(userText, /"project"\s*:/);
  });
});
