import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  analyzeEvidenceCapture,
  analyzeEvidenceRun,
  parseEvidenceJsonl,
  segmentEvidenceRuns,
} from '../scripts/analyze-brep-g2-context.mjs';

function contextDiagnostics(overrides = {}) {
  const {
    conservativeTokens = 28000,
    schemaFreeTokens = 3000,
    systemTokens = 2000,
    bytesBeforeBrepContext = systemTokens * 4,
    addedBrepContextBytes = 0,
    currentBrepPresent = false,
    currentBrepTokens = 0,
    ordinaryHistoryTokens = 500,
    historicalBrepToolTokens = 0,
    historicalBrepSnapshotBytes = 0,
    effectiveModelTokens = schemaFreeTokens - systemTokens,
    imageTokens = 0,
    projectionApplied = false,
    removedToolCalls = 0,
    removedToolResults = 0,
    removedToolInputBytes = 0,
    removedToolOutputBytes = 0,
    insertedRevisionSummaries = 0,
  } = overrides;

  return {
    schemaVersion: 1,
    label: 'ai context diagnostics',
    payload: {
      modelId: 'agent/opencode/llama-swap/laguna-xs-128k',
      transportKind: 'streaming-opencode',
      modelBudgetSource: 'local-settings',
      estimator: {
        ordinaryUtf8BytesPerToken: 4,
        base64CharsPerToken: 2,
      },
      systemInstructions: {
        estimatedTokens: systemTokens,
        bytesBeforeBrepContext,
        addedBrepContextBytes,
      },
      providerToolSchemas: { estimatedTokens: 25000 },
      currentCanonicalBrep: {
        present: currentBrepPresent,
        estimatedTokens: currentBrepTokens,
      },
      ordinaryConversationHistory: {
        estimatedTokens: ordinaryHistoryTokens,
      },
      historicalBrepToolPayloads: {
        estimatedTokens: historicalBrepToolTokens,
      },
      historicalBrepSnapshots: {
        persistedBytes: historicalBrepSnapshotBytes,
      },
      brepModelProjection: {
        provider: {
          applied: projectionApplied,
          removedToolCalls,
          removedToolResults,
          removedToolInputBytes,
          removedToolOutputBytes,
          insertedRevisionSummaries,
        },
        branch: {
          applied: projectionApplied,
          removedBrepSnapshotParts: projectionApplied ? 1 : 0,
          removedBuildToolParts: projectionApplied ? 1 : 0,
          removedSnapshotBytes: projectionApplied
            ? historicalBrepSnapshotBytes
            : 0,
        },
      },
      images: { estimatedTokens: imageTokens },
      effectiveModelMessages: { estimatedTokens: effectiveModelTokens },
      total: {
        estimatedInputTokens: conservativeTokens,
        estimatedInputTokensExcludingProviderToolSchemas: schemaFreeTokens,
      },
      hardBudget: {
        enforced: true,
        hardInputHeadroomTokens: 80000,
      },
    },
  };
}

function stepStarted(stepNumber, context) {
  return {
    schemaVersion: 1,
    label: 'ai step started',
    payload: {
      modelId: 'agent/opencode/llama-swap/laguna-xs-128k',
      transportKind: 'streaming-opencode',
      stepNumber,
      activeTools: ['build_brep_project'],
      hardBudget: { hardInputHeadroomTokens: 80000 - stepNumber * 1000 },
      context,
    },
  };
}

function stepDiagnostics(stepNumber, providerUsage) {
  return {
    schemaVersion: 1,
    label: 'ai step diagnostics',
    payload: {
      stepNumber,
      providerUsage,
    },
  };
}

function actualUsage(inputTokens, outputTokens = 100, totalTokens = null) {
  const available = inputTokens !== null || outputTokens !== null;
  return {
    schemaVersion: 1,
    label: 'ai context actual usage',
    payload: {
      providerUsageAvailable: available,
      inputTokens,
      outputTokens,
      totalTokens:
        totalTokens ??
        (inputTokens === null || outputTokens === null
          ? null
          : inputTokens + outputTokens),
    },
  };
}

function singleStepContext(modelMessageEstimatedTokens) {
  return {
    modelMessageEstimatedTokens,
    modelMessageGrowthBytes: 0,
    toolResultOutputEstimatedTokens: 0,
    brepToolOutputEstimatedTokens: 0,
    brepToolPayloadEstimatedTokens: 0,
    imageEstimatedTokens: 0,
  };
}

describe('Phase G2 context evidence harness', () => {
  it('captures only the four bounded context diagnostics through the opt-in preload', () => {
    const dir = mkdtempSync(join(tmpdir(), 'brepia-g2-capture-'));
    const evidencePath = join(dir, 'evidence.jsonl');
    const preloadPath = resolve('scripts/brep-g2-context-capture.cjs');
    const program = `
      console.info('not captured', { raw: 'ignore me' });
      console.info('ai context diagnostics', { modelId: 'test', total: { estimatedInputTokens: 5 } });
      console.info('ai step started', { stepNumber: 1, context: { modelMessageEstimatedTokens: 2 } });
      console.info('ai step diagnostics', { stepNumber: 1, providerUsage: null });
      console.info('ai context actual usage', { providerUsageAvailable: false });
    `;

    try {
      const result = spawnSync(
        process.execPath,
        ['--require', preloadPath, '-e', program],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PCAD_G2_CONTEXT_EVIDENCE_JSONL: evidencePath,
          },
        },
      );
      expect(result.status).toBe(0);

      const records = parseEvidenceJsonl(readFileSync(evidencePath, 'utf8'));
      expect(records.map((record) => record.label)).toEqual([
        'ai context diagnostics',
        'ai step started',
        'ai step diagnostics',
        'ai context actual usage',
      ]);
      expect(records.every((record) => record.schemaVersion === 1)).toBe(true);
      expect(JSON.stringify(records)).not.toContain('ignore me');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('classifies Brepia-side growth from consecutive internal-step deltas and preserves reported OpenCode usage', () => {
    const records = [
      contextDiagnostics(),
      stepStarted(1, {
        modelMessageEstimatedTokens: 1000,
        modelMessageGrowthBytes: 0,
        toolResultOutputEstimatedTokens: 0,
        brepToolOutputEstimatedTokens: 0,
        brepToolPayloadEstimatedTokens: 0,
        imageEstimatedTokens: 0,
      }),
      stepDiagnostics(1, {
        inputTokens: 5000,
        outputTokens: 500,
        totalTokens: 5500,
      }),
      stepStarted(2, {
        modelMessageEstimatedTokens: 1600,
        modelMessageGrowthBytes: 2400,
        toolResultOutputEstimatedTokens: 300,
        brepToolOutputEstimatedTokens: 200,
        brepToolPayloadEstimatedTokens: 200,
        imageEstimatedTokens: 0,
      }),
      stepDiagnostics(2, {
        inputTokens: 5600,
        outputTokens: 600,
        totalTokens: 6200,
      }),
      actualUsage(10600, 1100, 11700),
    ];

    const report = analyzeEvidenceRun(records);
    expect(report.status).toBe('consecutive_steps_available');
    expect(report.staticContext).toMatchObject({
      estimatedInputTokens: 28000,
      estimatedInputTokensExcludingProviderToolSchemas: 3000,
      providerToolSchemaEstimatedTokens: 25000,
      hardBudgetEnforced: true,
    });
    expect(report.steps[1]).toMatchObject({
      modelMessageGrowthTokens: 600,
      toolResultGrowthTokens: 300,
      brepToolPayloadGrowthTokens: 200,
      residualModelMessageGrowthTokens: 300,
      externalInputGrowthTokens: 600,
    });
    expect(report.brepiaSideDominantGrowth).toEqual([
      {
        name: 'conversation prose/reasoning or other model-message state',
        estimatedGrowthTokens: 300,
      },
    ]);
    expect(report.externalSessionUsage).toMatchObject({
      status: 'reported',
      positiveInputGrowthObserved: true,
      inputGrowthTokens: [600],
    });
  });

  it('keeps missing external-session token usage unavailable rather than converting it to zero', () => {
    const records = [
      contextDiagnostics(),
      stepStarted(1, singleStepContext(1000)),
      stepDiagnostics(1, null),
      actualUsage(null, null),
    ];

    const runs = segmentEvidenceRuns(records);
    expect(runs).toHaveLength(1);
    const report = analyzeEvidenceRun(runs[0]);
    expect(report.status).toBe('insufficient_consecutive_steps');
    expect(report.externalSessionUsage).toEqual({
      status: 'unavailable',
      positiveInputGrowthObserved: null,
      inputGrowthTokens: [],
      finalActualUsage: null,
    });
  });

  it('classifies normal one-step Native BRep work from consecutive turns instead of requiring artificial repairs', () => {
    const records = [
      contextDiagnostics({
        conservativeTokens: 25572,
        schemaFreeTokens: 515,
        systemTokens: 371,
        effectiveModelTokens: 144,
      }),
      stepStarted(1, singleStepContext(144)),
      stepDiagnostics(1, {
        inputTokens: 11896,
        outputTokens: 700,
        totalTokens: 12596,
      }),
      actualUsage(11896, 700, 12596),

      contextDiagnostics({
        conservativeTokens: 26457,
        schemaFreeTokens: 1400,
        systemTokens: 1100,
        bytesBeforeBrepContext: 2000,
        addedBrepContextBytes: 2400,
        currentBrepPresent: true,
        currentBrepTokens: 550,
        ordinaryHistoryTokens: 1800,
        historicalBrepToolTokens: 3000,
        historicalBrepSnapshotBytes: 9000,
        effectiveModelTokens: 300,
        projectionApplied: true,
        removedToolCalls: 1,
        removedToolResults: 1,
        removedToolInputBytes: 8000,
        removedToolOutputBytes: 1000,
        insertedRevisionSummaries: 1,
      }),
      stepStarted(1, singleStepContext(300)),
      stepDiagnostics(1, {
        inputTokens: 13200,
        outputTokens: 650,
        totalTokens: 13850,
      }),
      actualUsage(13200, 650, 13850),

      contextDiagnostics({
        conservativeTokens: 26607,
        schemaFreeTokens: 1550,
        systemTokens: 1120,
        bytesBeforeBrepContext: 2040,
        addedBrepContextBytes: 2440,
        currentBrepPresent: true,
        currentBrepTokens: 560,
        ordinaryHistoryTokens: 2600,
        historicalBrepToolTokens: 6000,
        historicalBrepSnapshotBytes: 18000,
        effectiveModelTokens: 430,
        projectionApplied: true,
        removedToolCalls: 2,
        removedToolResults: 2,
        removedToolInputBytes: 16000,
        removedToolOutputBytes: 2000,
        insertedRevisionSummaries: 2,
      }),
      stepStarted(1, singleStepContext(430)),
      stepDiagnostics(1, {
        inputTokens: 14550,
        outputTokens: 620,
        totalTokens: 15170,
      }),
      actualUsage(14550, 620, 15170),
    ];

    const report = analyzeEvidenceCapture(records);
    expect(report.status).toBe('consecutive_turns_available');
    expect(report.turnCount).toBe(3);
    expect(report.turns.every((turn) => turn.internalStepCount === 1)).toBe(true);
    expect(report.oneTimeCurrentBrepActivationTokens).toBe(600);
    expect(report.turnDeltas).toEqual([
      expect.objectContaining({
        fromTurn: 1,
        toTurn: 2,
        schemaFreeGrowthTokens: 885,
        brepContextGrowthTokens: 600,
        activatesCurrentBrep: true,
        modelMessageGrowthTokens: 156,
        openCodeInputGrowthTokens: 1304,
        externalGrowthBeyondBrepiaEstimateTokens: 419,
      }),
      expect.objectContaining({
        fromTurn: 2,
        toTurn: 3,
        schemaFreeGrowthTokens: 150,
        brepContextGrowthTokens: 10,
        activatesCurrentBrep: false,
        modelMessageGrowthTokens: 130,
        openCodeInputGrowthTokens: 1350,
        externalGrowthBeyondBrepiaEstimateTokens: 1200,
      }),
    ]);
    expect(report.brepiaSideDominantTurnGrowth).toEqual([
      {
        name: 'conversation/projection model-message state',
        estimatedGrowthTokens: 286,
      },
    ]);
    expect(report.turns[2].providerProjection).toMatchObject({
      applied: true,
      removedToolCalls: 2,
      removedToolResults: 2,
      removedToolInputBytes: 16000,
      removedToolOutputBytes: 2000,
    });
    expect(report.externalSessionUsage).toMatchObject({
      status: 'reported',
      growthAvailable: true,
      positiveInputGrowthObserved: true,
      firstStepInputTokensByTurn: [11896, 13200, 14550],
      inputGrowthTokens: [1304, 1350],
      externalGrowthBeyondBrepiaEstimateTokens: [419, 1200],
    });
    expect(report.latestRun.status).toBe('insufficient_consecutive_steps');
  });
});
