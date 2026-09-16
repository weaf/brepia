import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { GenerationRunEventInput } from '../shared/generationRunEvent';
import { createGenerationRunTelemetry } from '../src/server/generationRunTelemetry';

describe('generation run telemetry counters', () => {
  it('keeps invocation, candidate, repair, build and model-step counters run-global', () => {
    const events: GenerationRunEventInput[] = [];
    const telemetry = createGenerationRunTelemetry((event) => events.push(event));

    telemetry.externalAgentInvoked();
    telemetry.canonicalCandidate({
      accepted: false,
      errorCode: 'graph_integrity',
      errorMessage: 'Disconnected canonical graph.',
    });
    telemetry.transportRepair();
    telemetry.externalAgentInvoked();
    telemetry.canonicalCandidate({ accepted: true });

    const firstBuild = telemetry.buildAttemptStarted();
    telemetry.buildAttemptFinished(firstBuild, {
      accepted: false,
      errorCode: 'graph_integrity',
    });
    const secondBuild = telemetry.buildAttemptStarted();
    telemetry.buildAttemptFinished(secondBuild, { accepted: true });

    telemetry.modelStep({ contextUsedTokens: 12000, contextLimitTokens: 131072 });
    telemetry.modelStep({ contextUsedTokens: 18000, contextLimitTokens: 131072 });

    assert.deepEqual(events, [
      { kind: 'external_agent_invoked', invocationNumber: 1 },
      { kind: 'canonical_candidate_received', candidateNumber: 1 },
      {
        kind: 'canonical_candidate_rejected',
        candidateNumber: 1,
        errorCode: 'graph_integrity',
        errorMessage: 'Disconnected canonical graph.',
      },
      { kind: 'transport_repair', repairCount: 1 },
      { kind: 'external_agent_invoked', invocationNumber: 2 },
      { kind: 'canonical_candidate_received', candidateNumber: 2 },
      { kind: 'canonical_candidate_accepted', candidateNumber: 2 },
      { kind: 'build_attempt_started', buildAttemptNumber: 1 },
      {
        kind: 'build_rejected',
        buildAttemptNumber: 1,
        errorCode: 'graph_integrity',
      },
      { kind: 'build_attempt_started', buildAttemptNumber: 2 },
      { kind: 'build_accepted', buildAttemptNumber: 2 },
      { kind: 'model_step', modelStepNumber: 1 },
      {
        kind: 'context_usage',
        modelStepNumber: 1,
        contextUsedTokens: 12000,
        contextLimitTokens: 131072,
      },
      { kind: 'model_step', modelStepNumber: 2 },
      {
        kind: 'context_usage',
        modelStepNumber: 2,
        contextUsedTokens: 18000,
        contextLimitTokens: 131072,
      },
    ]);
  });

  it('bounds diagnostic text before it reaches persistence', () => {
    const events: GenerationRunEventInput[] = [];
    const telemetry = createGenerationRunTelemetry((event) => events.push(event));

    telemetry.canonicalCandidate({
      accepted: false,
      errorCode: 'invalid_project',
      errorMessage: 'x'.repeat(800),
    });

    const rejected = events.find(
      (event) => event.kind === 'canonical_candidate_rejected',
    );
    assert.equal(rejected?.errorMessage?.length, 500);
    assert.ok(rejected?.errorMessage?.endsWith('…'));
  });
});
