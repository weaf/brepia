import { convertToModelMessages } from 'ai';
import { describe, expect, it } from 'vitest';
import Tree from '@shared/Tree';
import { chatTools, type AppUIMessage } from '@shared/chatAi';
import { buildImportedArtifactMessages } from '@shared/importedArtifact';
import { getBuildParametricModelArtifact } from '@shared/parametricParts';
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
    const followUp: AppUIMessage = {
      id: 'dddddddd-4444-4444-8444-444444444444',
      role: 'user',
      parts: [{ type: 'text', text: 'Make the bracket wider.' }],
      metadata: {},
    };

    const modelMessages = await convertToModelMessages<AppUIMessage>(
      [asUiMessage(user), asUiMessage(assistant), followUp],
      { tools: chatTools },
    );

    const modelParts: unknown[] = [];
    for (const message of modelMessages) {
      if (Array.isArray(message.content)) modelParts.push(...message.content);
    }
    const buildCall = modelParts.find((part) => {
      if (!part || typeof part !== 'object') return false;
      const record = part as Record<string, unknown>;
      return (
        record['type'] === 'tool-call' &&
        record['toolName'] === 'build_parametric_model'
      );
    });

    expect(buildCall).toBeDefined();
    const input = (buildCall as Record<string, unknown>)['input'];
    expect(input).toEqual(artifact);
    expect((input as { code: string }).code).toBe(code);
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
