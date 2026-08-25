import { convertToModelMessages } from 'ai';
import { describe, expect, it } from 'vitest';
import Tree from '@shared/Tree';
import { chatTools, type AppUIMessage } from '@shared/chatAi';
import { buildImportedArtifactMessages } from '@shared/importedArtifact';
import {
  getBuildParametricModelArtifact,
  replaceBuildParametricModelOutput,
} from '@shared/parametricParts';
import { collectSuccessfulParametricBuilds } from '@/server/conversationWorkspaceModels';

const conversationId = '11111111-2222-4333-8444-555555555555';
const userMessageId = 'aaaaaaaa-1111-4111-8111-111111111111';
const assistantMessageId = 'bbbbbbbb-2222-4222-8222-222222222222';
const toolCallId = 'tool_import_cccccccc-3333-4333-8333-333333333333';
const code = 'width = 20;\nheight = 10;\ncube([width, width, height]);\n';
const artifact = { title: 'Imported bracket', version: 'v1', code };
const origin = {
  type: 'import' as const,
  source: 'upload' as const,
  filename: 'bracket.scad',
  importedAt: '2026-08-25T06:30:00.000Z',
};

function build(baseline: { status: 'success' } | { status: 'error'; errorText: string }) {
  return buildImportedArtifactMessages({
    conversationId,
    userMessageId,
    assistantMessageId,
    toolCallId,
    artifact,
    origin,
    baseline,
  });
}

function asUiMessage(message: ReturnType<typeof build>[number]): AppUIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts,
    metadata: message.metadata,
  };
}

async function modelBuildInputs(messages: AppUIMessage[]): Promise<unknown[]> {
  const modelMessages = await convertToModelMessages<AppUIMessage>(messages, {
    tools: chatTools,
  });
  const inputs: unknown[] = [];
  for (const message of modelMessages) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (!part || typeof part !== 'object') continue;
      const record = part as unknown as Record<string, unknown>;
      if (
        record['type'] === 'tool-call' &&
        record['toolName'] === 'build_parametric_model'
      ) {
        inputs.push(record['input']);
      }
    }
  }
  return inputs;
}

function followUp(text: string): AppUIMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text }],
    metadata: {},
  };
}

describe('imported artifact persistence primitive', () => {
  it('creates an import event followed by the assistant artifact as the active leaf', () => {
    const [user, assistant] = build({ status: 'success' });
    expect(user.parent_message_id).toBeNull();
    expect(assistant.parent_message_id).toBe(user.id);
    expect(user.parts).toEqual([
      { type: 'text', text: 'Imported OpenSCAD model: bracket.scad' },
    ]);
    expect(assistant.metadata).toEqual({ artifactOrigin: origin });

    const tree = new Tree([user, assistant]);
    expect(tree.getPath(assistant.id).map((node) => node.id)).toEqual([
      user.id,
      assistant.id,
    ]);
  });

  it('creates a completed successful build artifact with stable import provenance', () => {
    const [, assistant] = build({ status: 'success' });
    expect(assistant.parts[0]).toMatchObject({
      type: 'tool-build_parametric_model',
      toolCallId,
      state: 'output-available',
      input: artifact,
      output: { status: 'success', message: 'Imported OpenSCAD model.' },
    });
    expect(getBuildParametricModelArtifact(assistant.parts)).toEqual(artifact);
  });

  it('preserves the exact imported artifact in AI SDK model messages for the first edit', async () => {
    const [user, assistant] = build({ status: 'success' });
    const inputs = await modelBuildInputs([
      asUiMessage(user),
      asUiMessage(assistant),
      followUp('Make the bracket wider.'),
    ]);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toEqual(artifact);
    expect((inputs[0] as { code: string }).code).toBe(code);
  });

  it('preserves the imported artifact after a DB-style JSON reload before the first edit', async () => {
    const persistedRows = JSON.parse(JSON.stringify(build({ status: 'success' }))) as ReturnType<
      typeof build
    >;
    const [reloadedUser, reloadedAssistant] = persistedRows;

    const inputs = await modelBuildInputs([
      asUiMessage(reloadedUser),
      asUiMessage(reloadedAssistant),
      followUp('Increase the height after reload.'),
    ]);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toEqual(artifact);
    expect((inputs[0] as { code: string }).code).toBe(code);
  });

  it('sends a persisted parameter-edited artifact to AI instead of the original import', async () => {
    const [user, assistant] = build({ status: 'success' });
    const parameterEditedCode =
      'width = 35;\nheight = 10;\ncube([width, width, height]);\n';
    const parameterEditedArtifact = {
      ...artifact,
      code: parameterEditedCode,
    };
    const editedAssistant: AppUIMessage = {
      ...asUiMessage(assistant),
      parts: replaceBuildParametricModelOutput(
        assistant.parts,
        parameterEditedArtifact,
      ),
      metadata: {
        ...assistant.metadata,
        originalCode: code,
      },
    };

    const inputs = await modelBuildInputs([
      asUiMessage(user),
      editedAssistant,
      followUp('Now make it taller too.'),
    ]);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toEqual(parameterEditedArtifact);
    expect((inputs[0] as { code: string }).code).toBe(parameterEditedCode);
    expect((inputs[0] as { code: string }).code).not.toBe(code);
  });

  it('retains a failed imported artifact as output-error without creating a pending tool call', () => {
    const [, assistant] = build({
      status: 'error',
      errorText: 'Compilation failed: syntax error',
    });
    expect(assistant.parts[0]).toMatchObject({
      type: 'tool-build_parametric_model',
      toolCallId,
      state: 'output-error',
      input: artifact,
      errorText: 'Compilation failed: syntax error',
    });
    expect(getBuildParametricModelArtifact(assistant.parts)).toEqual(artifact);
  });

  it('is discovered by conversation workspace revision logic as a normal successful build', () => {
    const [user, assistant] = build({ status: 'success' });
    const rows = [
      {
        ...user,
        created_at: '2026-08-25T06:30:00.000Z',
      },
      {
        ...assistant,
        created_at: '2026-08-25T06:30:01.000Z',
      },
    ];
    const builds = collectSuccessfulParametricBuilds(rows, assistant.id);
    expect(builds).toHaveLength(1);
    expect(builds[0]).toMatchObject({
      toolCallId,
      messageId: assistant.id,
      title: artifact.title,
      version: 'v1',
      code,
      source: 'build',
    });
  });

  it('does not expose a failed import as a successful workspace revision', () => {
    const [user, assistant] = build({
      status: 'error',
      errorText: 'Compilation failed',
    });
    const rows = [
      { ...user, created_at: '2026-08-25T06:30:00.000Z' },
      { ...assistant, created_at: '2026-08-25T06:30:01.000Z' },
    ];
    expect(collectSuccessfulParametricBuilds(rows, assistant.id)).toEqual([]);
  });
});
