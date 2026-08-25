import { convertToModelMessages } from 'ai';
import { describe, expect, it } from 'vitest';
import Tree from '@shared/Tree';
import { chatTools, type AppUIMessage } from '@shared/chatAi';
import { buildImportedArtifactMessages } from '@shared/importedArtifact';
import {
  getBuildParametricModelArtifact,
  replaceBuildParametricModelOutput,
} from '@shared/parametricParts';
import type { ParametricArtifact } from '@shared/types';
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

type TestRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  parts: AppUIMessage['parts'];
  metadata: AppUIMessage['metadata'];
  parent_message_id: string | null;
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

function asUiMessage(message: {
  id: string;
  role: 'user' | 'assistant';
  parts: AppUIMessage['parts'];
  metadata?: AppUIMessage['metadata'];
}): AppUIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts,
    metadata: message.metadata ?? {},
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

function buildAssistantRow({
  id,
  parentMessageId,
  nextArtifact,
  nextToolCallId,
}: {
  id: string;
  parentMessageId: string;
  nextArtifact: ParametricArtifact;
  nextToolCallId: string;
}): TestRow {
  const [, importedAssistant] = build({ status: 'success' });
  const parts = replaceBuildParametricModelOutput(
    importedAssistant.parts,
    nextArtifact,
  ).map((part) =>
    part.type === 'tool-build_parametric_model'
      ? { ...part, toolCallId: nextToolCallId }
      : part,
  );
  return {
    id,
    conversation_id: conversationId,
    role: 'assistant',
    parts,
    metadata: {},
    parent_message_id: parentMessageId,
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

  it('keeps retry branches isolated and uses the selected branch artifact', async () => {
    const [importUser, importAssistant] = build({ status: 'success' });
    const editUser: TestRow = {
      id: 'dddddddd-4444-4444-8444-444444444444',
      conversation_id: conversationId,
      role: 'user',
      parts: [{ type: 'text', text: 'Make it wider.' }],
      metadata: {},
      parent_message_id: importAssistant.id,
    };
    const branchAArtifact: ParametricArtifact = {
      ...artifact,
      code: 'width = 30;\nheight = 10;\ncube([width, width, height]);\n',
    };
    const branchBArtifact: ParametricArtifact = {
      ...artifact,
      code: 'width = 45;\nheight = 10;\ncube([width, width, height]);\n',
    };
    const branchA = buildAssistantRow({
      id: 'eeeeeeee-5555-4555-8555-555555555555',
      parentMessageId: editUser.id,
      nextArtifact: branchAArtifact,
      nextToolCallId: 'tool_branch_a',
    });
    const branchB = buildAssistantRow({
      id: 'ffffffff-6666-4666-8666-666666666666',
      parentMessageId: editUser.id,
      nextArtifact: branchBArtifact,
      nextToolCallId: 'tool_branch_b',
    });
    const tree = new Tree<TestRow>([
      importUser as TestRow,
      importAssistant as TestRow,
      editUser,
      branchA,
      branchB,
    ]);

    const branchAInputs = await modelBuildInputs([
      ...tree.getPath(branchA.id).map(asUiMessage),
      followUp('Continue from branch A.'),
    ]);
    const branchBInputs = await modelBuildInputs([
      ...tree.getPath(branchB.id).map(asUiMessage),
      followUp('Continue from branch B.'),
    ]);

    expect(branchAInputs.at(-1)).toEqual(branchAArtifact);
    expect(branchBInputs.at(-1)).toEqual(branchBArtifact);
    expect(branchAInputs.at(-1)).not.toEqual(branchBArtifact);
    expect(branchBInputs.at(-1)).not.toEqual(branchAArtifact);
  });

  it('preserves the exact artifact when a history item is restored as a new leaf', async () => {
    const [importUser, importAssistant] = build({ status: 'success' });
    const editUser: TestRow = {
      id: '12121212-7777-4777-8777-777777777777',
      conversation_id: conversationId,
      role: 'user',
      parts: [{ type: 'text', text: 'Round the edges.' }],
      metadata: {},
      parent_message_id: importAssistant.id,
    };
    const editedArtifact: ParametricArtifact = {
      ...artifact,
      code: 'width = 28;\nheight = 12;\ncube([width, width, height]);\n',
    };
    const originalAssistant = buildAssistantRow({
      id: '13131313-8888-4888-8888-888888888888',
      parentMessageId: editUser.id,
      nextArtifact: editedArtifact,
      nextToolCallId: 'tool_history_original',
    });
    const restoredAssistant: TestRow = {
      ...originalAssistant,
      id: '14141414-9999-4999-8999-999999999999',
      parts: JSON.parse(JSON.stringify(originalAssistant.parts)) as AppUIMessage['parts'],
      metadata: JSON.parse(
        JSON.stringify(originalAssistant.metadata ?? {}),
      ) as AppUIMessage['metadata'],
    };
    const tree = new Tree<TestRow>([
      importUser as TestRow,
      importAssistant as TestRow,
      editUser,
      originalAssistant,
      restoredAssistant,
    ]);

    const restoredInputs = await modelBuildInputs([
      ...tree.getPath(restoredAssistant.id).map(asUiMessage),
      followUp('Continue from the restored model.'),
    ]);

    expect(restoredInputs.at(-1)).toEqual(editedArtifact);
    expect(getBuildParametricModelArtifact(restoredAssistant.parts)).toEqual(
      editedArtifact,
    );
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
