import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  analyzeEvidenceRun,
  parseEvidenceJsonl,
  segmentEvidenceRuns,
} from '../scripts/analyze-brep-g2-context.mjs';

function contextDiagnostics() {
  return {
    schemaVersion: 1,
    label: 'ai context diagnostics',
    payload: {
      modelId: 'agent/opencode/llama-swap/laguna-xs-128k',
      transportKind: 'streaming-opencode',
      modelBudgetSource: 'local-settings',
      providerToolSchemas: { estimatedTokens: 25000 },
      total: {
        estimatedInputTokens: 28000,
        estimatedInputTokensExcludingProviderToolSchemas: 3000,
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

  it('classifies Brepia-side growth from consecutive deltas and preserves reported OpenCode usage', () => {
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
      {
        schemaVersion: 1,
        label: 'ai context actual usage',
        payload: {
          providerUsageAvailable: true,
          inputTokens: 10600,
          outputTokens: 1100,
          totalTokens: 11700,
        },
      },
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
      stepStarted(1, {
        modelMessageEstimatedTokens: 1000,
        modelMessageGrowthBytes: 0,
        toolResultOutputEstimatedTokens: 0,
        brepToolOutputEstimatedTokens: 0,
        brepToolPayloadEstimatedTokens: 0,
        imageEstimatedTokens: 0,
      }),
      stepDiagnostics(1, null),
      {
        schemaVersion: 1,
        label: 'ai context actual usage',
        payload: {
          providerUsageAvailable: false,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
        },
      },
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
});
