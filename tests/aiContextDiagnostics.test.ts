import { describe, expect, it } from 'vitest';
import { chatTools, type AppUIMessage } from '../shared/chatAi';
import {
  buildAiContextDiagnostics,
  deriveContextSafetyMargin,
} from '../src/server/aiContextDiagnostics';

const project = {
  schemaVersion: 1,
  id: 'contextFixture',
  name: 'Context fixture',
  units: 'mm',
  placement: {
    origin: [0, 0, 0],
    xAxis: [1, 0, 0],
    yAxis: [0, 1, 0],
  },
  parameters: [
    {
      id: 'width',
      label: 'Width',
      type: 'number',
      unit: 'mm',
      default: 1200,
    },
  ],
  nodes: [
    {
      id: 'body',
      type: 'box',
      width: { parameter: 'width' },
      depth: 600,
      height: 1800,
    },
  ],
  resultNodeId: 'body',
} as const;

const rawUserMarker = 'RAW_USER_CONTEXT_SHOULD_NOT_BE_LOGGED';
const rawProjectMarker = 'RAW_PROJECT_CONTEXT_SHOULD_NOT_BE_LOGGED';
const base64 = 'A'.repeat(128);

function branchFixture(): AppUIMessage[] {
  return [
    {
      id: 'user-1',
      role: 'user',
      metadata: {},
      parts: [{ type: 'text', text: rawUserMarker }],
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      metadata: {},
      parts: [
        {
          type: 'tool-build_brep_project',
          toolCallId: 'call-1',
          state: 'output-available',
          input: {
            title: rawProjectMarker,
            version: 'v1',
            project,
          },
          output: {
            status: 'success',
            message: 'Created canonical native BRep project.',
          },
        },
        {
          type: 'data-brep-project',
          data: {
            title: rawProjectMarker,
            version: 'v1',
            source: { kind: 'brep', source: project },
          },
        },
      ],
    },
  ] as unknown as AppUIMessage[];
}

describe('AI context diagnostics', () => {
  it('measures the C1 categories without retaining raw prompt/project/image payloads', async () => {
    const diagnostics = await buildAiContextDiagnostics({
      systemPrompt: `BASE SYSTEM\n\nCURRENT BREP ${rawProjectMarker}`,
      systemPromptBeforeBrepContext: 'BASE SYSTEM',
      tools: {
        build_brep_project: chatTools.build_brep_project,
      },
      branchMessages: branchFixture(),
      modelMessages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: rawUserMarker },
            {
              type: 'image',
              image: `data:image/png;base64,${base64}`,
            },
          ],
        },
      ],
      currentBrepProject: project,
      modelContextLimit: 131072,
      modelOutputLimit: 16384,
      reservedOutputTokens: 8192,
    });

    expect(diagnostics.systemInstructions.bytes).toBeGreaterThan(0);
    expect(diagnostics.systemInstructions.addedBrepContextBytes).toBeGreaterThan(0);
    expect(diagnostics.providerToolSchemas.count).toBe(1);
    expect(diagnostics.providerToolSchemas.tools[0]).toMatchObject({
      name: 'build_brep_project',
      schemaAvailable: true,
    });
    expect(diagnostics.providerToolSchemas.bytes).toBeGreaterThan(0);

    expect(diagnostics.currentCanonicalBrep).toMatchObject({ present: true });
    expect(diagnostics.currentCanonicalBrep.bytes).toBeGreaterThan(0);
    expect(diagnostics.ordinaryConversationHistory).toMatchObject({
      messageCount: 2,
      textPartCount: 1,
    });
    expect(diagnostics.historicalBrepToolPayloads.callCount).toBe(1);
    expect(diagnostics.historicalBrepToolPayloads.inputBytes).toBeGreaterThan(0);
    expect(diagnostics.historicalBrepToolPayloads.outputBytes).toBeGreaterThan(0);
    expect(diagnostics.historicalBrepSnapshots).toMatchObject({
      count: 1,
      providerEstimatedTokens: 0,
    });
    expect(diagnostics.historicalBrepSnapshots.persistedBytes).toBeGreaterThan(0);
    expect(diagnostics.brepModelProjection.branch).toMatchObject({
      applied: true,
      removedBuildToolParts: 1,
      removedBrepSnapshotParts: 1,
      summarizedAcceptedBuilds: 1,
    });
    expect(diagnostics.brepModelProjection.provider).toMatchObject({
      applied: true,
      removedToolCalls: 0,
      removedToolResults: 0,
    });
    expect(diagnostics.images).toEqual({
      count: 1,
      base64Chars: 128,
      estimatedTokens: 64,
    });
    expect(diagnostics.effectiveModelMessages.count).toBe(1);
    expect(diagnostics.total.estimatedInputTokens).toBeGreaterThan(0);

    expect(diagnostics.budget).toMatchObject({
      contextWindowTokens: 131072,
      modelOutputLimitTokens: 16384,
      reservedOutputTokens: 8192,
      safetyMarginTokens: 8192,
      usableInputBudgetTokens: 114688,
      reservedOutputExceedsModelLimit: false,
    });
    expect(diagnostics.budget.estimatedHeadroomTokens).not.toBeNull();

    const serializedDiagnostics = JSON.stringify(diagnostics);
    expect(serializedDiagnostics).not.toContain(rawUserMarker);
    expect(serializedDiagnostics).not.toContain(rawProjectMarker);
    expect(serializedDiagnostics).not.toContain(base64);
  });

  it('projects superseded BRep provider tool payloads in place before dispatch diagnostics', async () => {
    const modelMessages: unknown[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Create it.' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'build_brep_project',
            input: { title: rawProjectMarker, project },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'build_brep_project',
            output: {
              status: 'success',
              message: 'Created canonical native BRep project.',
            },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Make it taller.' }],
      },
    ];

    const diagnostics = await buildAiContextDiagnostics({
      systemPrompt: 'system with current canonical BRep',
      systemPromptBeforeBrepContext: 'system',
      tools: { build_brep_project: chatTools.build_brep_project },
      branchMessages: branchFixture(),
      modelMessages,
      currentBrepProject: project,
      modelContextLimit: 131072,
      modelOutputLimit: 16384,
      reservedOutputTokens: 8192,
    });

    expect(diagnostics.brepModelProjection.provider).toMatchObject({
      applied: true,
      removedToolCalls: 1,
      removedToolResults: 1,
      insertedRevisionSummaries: 1,
    });
    expect(diagnostics.brepModelProjection.provider.removedToolInputBytes).toBeGreaterThan(
      0,
    );
    expect(diagnostics.brepModelProjection.provider.removedToolOutputBytes).toBeGreaterThan(
      0,
    );

    const serializedModelMessages = JSON.stringify(modelMessages);
    expect(serializedModelMessages).not.toContain('tool-call');
    expect(serializedModelMessages).not.toContain('tool-result');
    expect(serializedModelMessages).not.toContain(rawProjectMarker);
    expect(serializedModelMessages).toContain(
      'Prior accepted Native BRep revision: Created canonical native BRep project.',
    );
  });

  it('keeps budget metadata unknown instead of inventing a model context limit', async () => {
    const diagnostics = await buildAiContextDiagnostics({
      systemPrompt: 'system',
      systemPromptBeforeBrepContext: 'system',
      tools: {},
      branchMessages: [],
      modelMessages: [],
      modelContextLimit: null,
      modelOutputLimit: null,
      reservedOutputTokens: 4096,
    });

    expect(diagnostics.brepModelProjection.provider.applied).toBe(false);
    expect(diagnostics.budget).toMatchObject({
      contextWindowTokens: null,
      modelOutputLimitTokens: null,
      reservedOutputTokens: 4096,
      safetyMarginTokens: null,
      usableInputBudgetTokens: null,
      estimatedHeadroomTokens: null,
      reservedOutputExceedsModelLimit: false,
    });
  });

  it('derives the bounded initial safety margin policy deterministically', () => {
    expect(deriveContextSafetyMargin(null)).toBeNull();
    expect(deriveContextSafetyMargin(32768)).toBe(8192);
    expect(deriveContextSafetyMargin(131072)).toBe(8192);
    expect(deriveContextSafetyMargin(262144)).toBe(12288);
  });
});
