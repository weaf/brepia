import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const contextDiagnosticsSource = fs.readFileSync(
  new URL('../src/server/aiContextDiagnostics.ts', import.meta.url),
  'utf8',
);
const aiChatSource = fs.readFileSync(
  new URL('../src/server/aiChat.ts', import.meta.url),
  'utf8',
);
const openCodeSource = fs.readFileSync(
  new URL('../src/server/opencode.ts', import.meta.url),
  'utf8',
);
const telemetrySource = fs.readFileSync(
  new URL('../src/server/generationRunTelemetry.ts', import.meta.url),
  'utf8',
);

describe('Phase G context-growth measurement coverage', () => {
  it('retains the C1 static budget decomposition needed beside per-step growth', () => {
    assert.match(contextDiagnosticsSource, /systemInstructions:/);
    assert.match(contextDiagnosticsSource, /providerToolSchemas:/);
    assert.match(contextDiagnosticsSource, /currentCanonicalBrep:/);
    assert.match(contextDiagnosticsSource, /effectiveModelMessages:/);
    assert.match(contextDiagnosticsSource, /historicalBrepToolPayloads:/);
  });

  it('records per-step provider-message and BRep payload growth plus provider usage', () => {
    assert.match(aiChatSource, /measureAiStepContext\(messages\)/);
    assert.match(aiChatSource, /modelMessageGrowthBytes:/);
    assert.match(aiChatSource, /brepToolPayloadGrowthBytes:/);
    assert.match(aiChatSource, /usageAvailable/);
    assert.match(aiChatSource, /inputTokens/);
    assert.match(aiChatSource, /outputTokens/);
    assert.match(aiChatSource, /totalTokens/);
  });

  it('preserves OpenCode session token evidence when the external runtime reports it', () => {
    assert.match(openCodeSource, /usageFromOpenCodeTokens/);
    assert.match(openCodeSource, /step\.ended/);
    assert.match(openCodeSource, /state\.usage = usage/);
  });

  it('retains cumulative model-step and transport-repair counters in durable telemetry', () => {
    assert.match(telemetrySource, /modelStepNumber \+= 1/);
    assert.match(telemetrySource, /repairCount \+= 1/);
    assert.match(telemetrySource, /kind: 'context_usage'/);
    assert.match(telemetrySource, /kind: 'transport_repair'/);
  });

  it('does not introduce compaction into the measurement phase', () => {
    assert.doesNotMatch(aiChatSource, /context compaction|compactContext/i);
  });
});
