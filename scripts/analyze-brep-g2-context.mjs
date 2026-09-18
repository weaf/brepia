#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const REQUIRED_LABELS = [
  'ai context diagnostics',
  'ai step started',
  'ai step diagnostics',
  'ai context actual usage',
];

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeDelta(current, previous) {
  if (current === null || previous === null) return null;
  return Math.max(0, current - previous);
}

function estimatedTokensFromBytes(bytes, bytesPerToken) {
  if (bytes === null || bytesPerToken === null || bytesPerToken <= 0) return null;
  return Math.ceil(bytes / bytesPerToken);
}

export function parseEvidenceJsonl(text) {
  const records = [];
  for (const [index, rawLine] of text.split('\n').entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(
        `Invalid G2 evidence JSON on line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`Invalid G2 evidence record on line ${index + 1}`);
    }
    records.push(record);
  }
  return records;
}

export function segmentEvidenceRuns(records) {
  const runs = [];
  let current = null;

  for (const record of records) {
    if (record.label === 'ai context diagnostics') {
      if (current) runs.push(current);
      current = [record];
      continue;
    }
    if (current) current.push(record);
  }

  if (current) runs.push(current);
  return runs;
}

function usageForStep(stepDiagnostics) {
  const payload = asRecord(stepDiagnostics?.payload);
  const usage = asRecord(payload.providerUsage);
  const inputTokens = finiteNumber(usage.inputTokens);
  const outputTokens = finiteNumber(usage.outputTokens);
  const totalTokens = finiteNumber(usage.totalTokens);
  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return null;
  }
  return { inputTokens, outputTokens, totalTokens };
}

function dominantContributions(contributions) {
  const entries = Object.entries(contributions).filter(([, value]) => value > 0);
  if (entries.length === 0) return [];
  const maximum = Math.max(...entries.map(([, value]) => value));
  return entries
    .filter(([, value]) => value >= maximum * 0.9)
    .map(([name, value]) => ({ name, estimatedGrowthTokens: value }));
}

export function analyzeEvidenceRun(records) {
  if (!records.length || records[0]?.label !== 'ai context diagnostics') {
    throw new Error('G2 evidence run is missing the initial ai context diagnostics record');
  }

  const staticPayload = asRecord(records[0].payload);
  const starts = records
    .filter((record) => record.label === 'ai step started')
    .sort(
      (left, right) =>
        (finiteNumber(asRecord(left.payload).stepNumber) ?? 0) -
        (finiteNumber(asRecord(right.payload).stepNumber) ?? 0),
    );
  const diagnosticsByStep = new Map(
    records
      .filter((record) => record.label === 'ai step diagnostics')
      .map((record) => [finiteNumber(asRecord(record.payload).stepNumber), record]),
  );
  const actualUsage = records
    .filter((record) => record.label === 'ai context actual usage')
    .at(-1);

  const rows = [];
  let previousContext = null;
  let previousReportedInputTokens = null;
  const contributions = {
    'repeated BRep tool/canonical payload state': 0,
    'other tool diagnostics/results': 0,
    images: 0,
    'conversation prose/reasoning or other model-message state': 0,
  };
  const externalInputGrowth = [];

  for (const start of starts) {
    const payload = asRecord(start.payload);
    const stepNumber = finiteNumber(payload.stepNumber);
    const context = asRecord(payload.context);
    const previous = previousContext ?? {};

    const modelTokens = finiteNumber(context.modelMessageEstimatedTokens);
    const previousModelTokens = finiteNumber(previous.modelMessageEstimatedTokens);
    const modelGrowthTokens = nonNegativeDelta(modelTokens, previousModelTokens);

    const toolResultTokens = finiteNumber(context.toolResultOutputEstimatedTokens);
    const previousToolResultTokens = finiteNumber(
      previous.toolResultOutputEstimatedTokens,
    );
    const toolResultGrowthTokens = nonNegativeDelta(
      toolResultTokens,
      previousToolResultTokens,
    );

    const brepOutputTokens = finiteNumber(context.brepToolOutputEstimatedTokens);
    const previousBrepOutputTokens = finiteNumber(
      previous.brepToolOutputEstimatedTokens,
    );
    const brepOutputGrowthTokens = nonNegativeDelta(
      brepOutputTokens,
      previousBrepOutputTokens,
    );

    const brepPayloadTokens = finiteNumber(context.brepToolPayloadEstimatedTokens);
    const previousBrepPayloadTokens = finiteNumber(
      previous.brepToolPayloadEstimatedTokens,
    );
    const brepPayloadGrowthTokens = nonNegativeDelta(
      brepPayloadTokens,
      previousBrepPayloadTokens,
    );

    const imageTokens = finiteNumber(context.imageEstimatedTokens);
    const previousImageTokens = finiteNumber(previous.imageEstimatedTokens);
    const imageGrowthTokens = nonNegativeDelta(imageTokens, previousImageTokens);

    const nonBrepToolResultGrowthTokens =
      toolResultGrowthTokens === null
        ? null
        : Math.max(0, toolResultGrowthTokens - (brepOutputGrowthTokens ?? 0));

    const residualGrowthTokens =
      modelGrowthTokens === null
        ? null
        : Math.max(
            0,
            modelGrowthTokens -
              (brepPayloadGrowthTokens ?? 0) -
              (nonBrepToolResultGrowthTokens ?? 0) -
              (imageGrowthTokens ?? 0),
          );

    if (previousContext) {
      contributions['repeated BRep tool/canonical payload state'] +=
        brepPayloadGrowthTokens ?? 0;
      contributions['other tool diagnostics/results'] +=
        nonBrepToolResultGrowthTokens ?? 0;
      contributions.images += imageGrowthTokens ?? 0;
      contributions['conversation prose/reasoning or other model-message state'] +=
        residualGrowthTokens ?? 0;
    }

    const finish = diagnosticsByStep.get(stepNumber) ?? null;
    const providerUsage = usageForStep(finish);
    let externalInputGrowthTokens = null;
    if (providerUsage?.inputTokens !== null) {
      if (previousReportedInputTokens !== null) {
        externalInputGrowthTokens = Math.max(
          0,
          providerUsage.inputTokens - previousReportedInputTokens,
        );
        externalInputGrowth.push(externalInputGrowthTokens);
      }
      previousReportedInputTokens = providerUsage.inputTokens;
    }

    rows.push({
      stepNumber,
      modelMessageEstimatedTokens: modelTokens,
      modelMessageGrowthTokens: previousContext ? modelGrowthTokens : 0,
      modelMessageGrowthBytes:
        finiteNumber(context.modelMessageGrowthBytes) ?? null,
      toolResultOutputEstimatedTokens: toolResultTokens,
      toolResultGrowthTokens: previousContext ? toolResultGrowthTokens : 0,
      brepToolPayloadEstimatedTokens: brepPayloadTokens,
      brepToolPayloadGrowthTokens: previousContext
        ? brepPayloadGrowthTokens
        : 0,
      imageEstimatedTokens: imageTokens,
      imageGrowthTokens: previousContext ? imageGrowthTokens : 0,
      residualModelMessageGrowthTokens: previousContext
        ? residualGrowthTokens
        : 0,
      activeTools: Array.isArray(payload.activeTools) ? payload.activeTools : [],
      hardInputHeadroomTokens:
        finiteNumber(asRecord(payload.hardBudget).hardInputHeadroomTokens) ?? null,
      providerUsage,
      externalInputGrowthTokens,
    });

    previousContext = context;
  }

  const actualPayload = asRecord(actualUsage?.payload);
  const externalUsageReported = rows.some((row) => row.providerUsage !== null);
  const externalGrowthReported = externalInputGrowth.some((value) => value > 0);
  const total = asRecord(staticPayload.total);
  const toolSchemas = asRecord(staticPayload.providerToolSchemas);
  const hardBudget = asRecord(staticPayload.hardBudget);

  const requiredLabelsPresent = Object.fromEntries(
    REQUIRED_LABELS.map((label) => [
      label,
      records.some((record) => record.label === label),
    ]),
  );

  return {
    status:
      rows.length >= 2
        ? 'consecutive_steps_available'
        : 'insufficient_consecutive_steps',
    transportKind:
      typeof staticPayload.transportKind === 'string'
        ? staticPayload.transportKind
        : null,
    modelId: typeof staticPayload.modelId === 'string' ? staticPayload.modelId : null,
    modelBudgetSource:
      typeof staticPayload.modelBudgetSource === 'string'
        ? staticPayload.modelBudgetSource
        : null,
    requiredLabelsPresent,
    staticContext: {
      estimatedInputTokens: finiteNumber(total.estimatedInputTokens),
      estimatedInputTokensExcludingProviderToolSchemas: finiteNumber(
        total.estimatedInputTokensExcludingProviderToolSchemas,
      ),
      providerToolSchemaEstimatedTokens: finiteNumber(toolSchemas.estimatedTokens),
      hardBudgetEnforced:
        typeof hardBudget.enforced === 'boolean' ? hardBudget.enforced : null,
      hardInputHeadroomTokens: finiteNumber(hardBudget.hardInputHeadroomTokens),
    },
    steps: rows,
    brepiaSideGrowthContributions: contributions,
    brepiaSideDominantGrowth:
      rows.length >= 2 ? dominantContributions(contributions) : [],
    externalSessionUsage: externalUsageReported
      ? {
          status: 'reported',
          positiveInputGrowthObserved: externalGrowthReported,
          inputGrowthTokens: externalInputGrowth,
          finalActualUsage: {
            inputTokens: finiteNumber(actualPayload.inputTokens),
            outputTokens: finiteNumber(actualPayload.outputTokens),
            totalTokens: finiteNumber(actualPayload.totalTokens),
          },
        }
      : {
          status: 'unavailable',
          positiveInputGrowthObserved: null,
          inputGrowthTokens: [],
          finalActualUsage: null,
        },
  };
}

function summarizeTurn(records, turnNumber) {
  const run = analyzeEvidenceRun(records);
  const payload = asRecord(records[0]?.payload);
  const estimator = asRecord(payload.estimator);
  const system = asRecord(payload.systemInstructions);
  const canonical = asRecord(payload.currentCanonicalBrep);
  const ordinary = asRecord(payload.ordinaryConversationHistory);
  const historicalBrep = asRecord(payload.historicalBrepToolPayloads);
  const snapshots = asRecord(payload.historicalBrepSnapshots);
  const effective = asRecord(payload.effectiveModelMessages);
  const images = asRecord(payload.images);
  const projection = asRecord(payload.brepModelProjection);
  const providerProjection = asRecord(projection.provider);
  const branchProjection = asRecord(projection.branch);
  const bytesPerToken = finiteNumber(estimator.ordinaryUtf8BytesPerToken) ?? 4;
  const addedBrepContextBytes = finiteNumber(system.addedBrepContextBytes);
  const firstReportedInput =
    run.steps.find(
      (step) =>
        step.providerUsage?.inputTokens !== null &&
        step.providerUsage?.inputTokens !== undefined,
    )?.providerUsage?.inputTokens ?? null;

  return {
    turnNumber,
    transportKind: run.transportKind,
    modelId: run.modelId,
    modelBudgetSource: run.modelBudgetSource,
    requiredLabelsPresent: run.requiredLabelsPresent,
    internalStepStatus: run.status,
    internalStepCount: run.steps.length,
    schemaFreeEstimatedInputTokens:
      run.staticContext.estimatedInputTokensExcludingProviderToolSchemas,
    conservativeEstimatedInputTokens: run.staticContext.estimatedInputTokens,
    providerToolSchemaEstimatedTokens:
      run.staticContext.providerToolSchemaEstimatedTokens,
    systemEstimatedTokens: finiteNumber(system.estimatedTokens),
    systemBytesBeforeBrepContext: finiteNumber(system.bytesBeforeBrepContext),
    addedBrepContextBytes,
    addedBrepContextEstimatedTokens: estimatedTokensFromBytes(
      addedBrepContextBytes,
      bytesPerToken,
    ),
    currentCanonicalBrepPresent:
      typeof canonical.present === 'boolean' ? canonical.present : null,
    currentCanonicalBrepEstimatedTokens: finiteNumber(canonical.estimatedTokens),
    ordinaryConversationEstimatedTokens: finiteNumber(ordinary.estimatedTokens),
    historicalBrepToolPayloadEstimatedTokens: finiteNumber(
      historicalBrep.estimatedTokens,
    ),
    historicalBrepSnapshotPersistedBytes: finiteNumber(snapshots.persistedBytes),
    effectiveModelMessageEstimatedTokens: finiteNumber(effective.estimatedTokens),
    imageEstimatedTokens: finiteNumber(images.estimatedTokens),
    providerProjection: {
      applied:
        typeof providerProjection.applied === 'boolean'
          ? providerProjection.applied
          : null,
      removedToolCalls: finiteNumber(providerProjection.removedToolCalls),
      removedToolResults: finiteNumber(providerProjection.removedToolResults),
      removedToolInputBytes: finiteNumber(providerProjection.removedToolInputBytes),
      removedToolOutputBytes: finiteNumber(providerProjection.removedToolOutputBytes),
      insertedRevisionSummaries: finiteNumber(
        providerProjection.insertedRevisionSummaries,
      ),
    },
    branchProjection: {
      applied:
        typeof branchProjection.applied === 'boolean'
          ? branchProjection.applied
          : null,
      removedBrepSnapshotParts: finiteNumber(
        branchProjection.removedBrepSnapshotParts,
      ),
      removedBuildToolParts: finiteNumber(branchProjection.removedBuildToolParts),
      removedSnapshotBytes: finiteNumber(branchProjection.removedSnapshotBytes),
    },
    openCodeFirstStepInputTokens: finiteNumber(firstReportedInput),
    run,
  };
}

export function analyzeEvidenceCapture(records) {
  const runs = segmentEvidenceRuns(records);
  if (runs.length === 0) {
    throw new Error('No ai context diagnostics record found in G2 evidence file');
  }

  const turns = runs.map((run, index) => summarizeTurn(run, index + 1));
  const sameTransportAndModel = turns.every(
    (turn) =>
      turn.transportKind === turns[0].transportKind &&
      turn.modelId === turns[0].modelId,
  );

  const turnDeltas = [];
  const contributions = {
    'current canonical BRep size changes after activation': 0,
    'conversation/projection model-message state': 0,
    images: 0,
    'transport/system instructions outside current BRep': 0,
  };
  let oneTimeCurrentBrepActivationTokens = 0;

  for (let index = 1; index < turns.length; index += 1) {
    const previous = turns[index - 1];
    const current = turns[index];
    const schemaFreeGrowthTokens = nonNegativeDelta(
      current.schemaFreeEstimatedInputTokens,
      previous.schemaFreeEstimatedInputTokens,
    );
    const systemGrowthTokens = nonNegativeDelta(
      current.systemEstimatedTokens,
      previous.systemEstimatedTokens,
    );
    const brepContextGrowthTokens = nonNegativeDelta(
      current.addedBrepContextEstimatedTokens,
      previous.addedBrepContextEstimatedTokens,
    );
    const modelMessageGrowthTokens = nonNegativeDelta(
      current.effectiveModelMessageEstimatedTokens,
      previous.effectiveModelMessageEstimatedTokens,
    );
    const imageGrowthTokens = nonNegativeDelta(
      current.imageEstimatedTokens,
      previous.imageEstimatedTokens,
    );
    const residualModelMessageGrowthTokens =
      modelMessageGrowthTokens === null
        ? null
        : Math.max(0, modelMessageGrowthTokens - (imageGrowthTokens ?? 0));
    const nonBrepSystemGrowthTokens =
      systemGrowthTokens === null
        ? null
        : Math.max(0, systemGrowthTokens - (brepContextGrowthTokens ?? 0));
    const persistedBrepToolPayloadGrowthTokens = nonNegativeDelta(
      current.historicalBrepToolPayloadEstimatedTokens,
      previous.historicalBrepToolPayloadEstimatedTokens,
    );
    const persistedBrepSnapshotGrowthBytes = nonNegativeDelta(
      current.historicalBrepSnapshotPersistedBytes,
      previous.historicalBrepSnapshotPersistedBytes,
    );
    const openCodeInputGrowthTokens = nonNegativeDelta(
      current.openCodeFirstStepInputTokens,
      previous.openCodeFirstStepInputTokens,
    );
    const externalGrowthBeyondBrepiaEstimateTokens =
      openCodeInputGrowthTokens === null || schemaFreeGrowthTokens === null
        ? null
        : Math.max(0, openCodeInputGrowthTokens - schemaFreeGrowthTokens);
    const activatesCurrentBrep =
      previous.currentCanonicalBrepPresent === false &&
      current.currentCanonicalBrepPresent === true;

    if (activatesCurrentBrep) {
      oneTimeCurrentBrepActivationTokens += brepContextGrowthTokens ?? 0;
    } else if (
      previous.currentCanonicalBrepPresent === true &&
      current.currentCanonicalBrepPresent === true
    ) {
      contributions['current canonical BRep size changes after activation'] +=
        brepContextGrowthTokens ?? 0;
    }
    contributions['conversation/projection model-message state'] +=
      residualModelMessageGrowthTokens ?? 0;
    contributions.images += imageGrowthTokens ?? 0;
    contributions['transport/system instructions outside current BRep'] +=
      nonBrepSystemGrowthTokens ?? 0;

    turnDeltas.push({
      fromTurn: previous.turnNumber,
      toTurn: current.turnNumber,
      schemaFreeGrowthTokens,
      systemGrowthTokens,
      brepContextGrowthTokens,
      activatesCurrentBrep,
      modelMessageGrowthTokens,
      imageGrowthTokens,
      residualModelMessageGrowthTokens,
      nonBrepSystemGrowthTokens,
      persistedBrepToolPayloadGrowthTokens,
      persistedBrepSnapshotGrowthBytes,
      openCodeInputGrowthTokens,
      externalGrowthBeyondBrepiaEstimateTokens,
    });
  }

  const openCodeInputByTurn = turns.map((turn) => turn.openCodeFirstStepInputTokens);
  const openCodeUsageReported = openCodeInputByTurn.some((value) => value !== null);
  const openCodeGrowth = turnDeltas
    .map((delta) => delta.openCodeInputGrowthTokens)
    .filter((value) => value !== null);
  const externalExcess = turnDeltas
    .map((delta) => delta.externalGrowthBeyondBrepiaEstimateTokens)
    .filter((value) => value !== null);

  const status = !sameTransportAndModel
    ? 'incompatible_turn_series'
    : turns.length >= 2
      ? 'consecutive_turns_available'
      : 'insufficient_consecutive_turns';

  return {
    status,
    turnCount: turns.length,
    transportKind: turns[0].transportKind,
    modelId: turns[0].modelId,
    modelBudgetSource: turns[0].modelBudgetSource,
    sameTransportAndModel,
    turns,
    turnDeltas,
    oneTimeCurrentBrepActivationTokens,
    brepiaSideTurnGrowthContributions: contributions,
    brepiaSideDominantTurnGrowth:
      status === 'consecutive_turns_available'
        ? dominantContributions(contributions)
        : [],
    externalSessionUsage: openCodeUsageReported
      ? {
          status: 'reported',
          firstStepInputTokensByTurn: openCodeInputByTurn,
          growthAvailable: openCodeGrowth.length > 0,
          positiveInputGrowthObserved: openCodeGrowth.some((value) => value > 0),
          inputGrowthTokens: openCodeGrowth,
          externalGrowthBeyondBrepiaEstimateTokens: externalExcess,
        }
      : {
          status: 'unavailable',
          firstStepInputTokensByTurn: openCodeInputByTurn,
          growthAvailable: false,
          positiveInputGrowthObserved: null,
          inputGrowthTokens: [],
          externalGrowthBeyondBrepiaEstimateTokens: [],
        },
    latestRun: turns.at(-1).run,
  };
}

function formatNullable(value) {
  return value === null || value === undefined ? 'unavailable' : String(value);
}

export function formatEvidenceRunMarkdown(report) {
  const lines = [
    '## Latest turn internal-step evidence',
    '',
    `- Internal-step status: **${report.status}**`,
    '',
    '| Step | Model msg tokens | Δ model | Tool-result tokens | Δ tool results | BRep payload tokens | Δ BRep | Δ residual | OpenCode input | Δ OpenCode input |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const row of report.steps) {
    lines.push(
      `| ${formatNullable(row.stepNumber)} | ${formatNullable(row.modelMessageEstimatedTokens)} | ${formatNullable(row.modelMessageGrowthTokens)} | ${formatNullable(row.toolResultOutputEstimatedTokens)} | ${formatNullable(row.toolResultGrowthTokens)} | ${formatNullable(row.brepToolPayloadEstimatedTokens)} | ${formatNullable(row.brepToolPayloadGrowthTokens)} | ${formatNullable(row.residualModelMessageGrowthTokens)} | ${formatNullable(row.providerUsage?.inputTokens)} | ${formatNullable(row.externalInputGrowthTokens)} |`,
    );
  }

  return lines;
}

export function formatEvidenceMarkdown(report) {
  const latest = report.turns.at(-1);
  const lines = [
    '# Native BRep Phase G2 context-growth evidence',
    '',
    `- Status: **${report.status}**`,
    `- Captured turns: ${report.turnCount}`,
    `- Transport: \`${formatNullable(report.transportKind)}\``,
    `- Model: \`${formatNullable(report.modelId)}\``,
    `- Model budget source: \`${formatNullable(report.modelBudgetSource)}\``,
    `- Latest conservative estimated input: ${formatNullable(latest?.conservativeEstimatedInputTokens)} tokens`,
    `- Latest schema-free estimated input: ${formatNullable(latest?.schemaFreeEstimatedInputTokens)} tokens`,
    `- Provider tool-schema estimate: ${formatNullable(latest?.providerToolSchemaEstimatedTokens)} tokens`,
    '',
    '## Consecutive turn deltas',
    '',
    '| Turn | Schema-free | Δ schema-free | System | Δ system | Current BRep ctx | Δ BRep ctx | Model msgs | Δ model msgs | OpenCode first-step input | Δ OpenCode | Δ external excess |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const turn of report.turns) {
    const delta = report.turnDeltas.find((entry) => entry.toTurn === turn.turnNumber);
    lines.push(
      `| ${turn.turnNumber} | ${formatNullable(turn.schemaFreeEstimatedInputTokens)} | ${delta ? formatNullable(delta.schemaFreeGrowthTokens) : '0'} | ${formatNullable(turn.systemEstimatedTokens)} | ${delta ? formatNullable(delta.systemGrowthTokens) : '0'} | ${formatNullable(turn.addedBrepContextEstimatedTokens)} | ${delta ? formatNullable(delta.brepContextGrowthTokens) : '0'} | ${formatNullable(turn.effectiveModelMessageEstimatedTokens)} | ${delta ? formatNullable(delta.modelMessageGrowthTokens) : '0'} | ${formatNullable(turn.openCodeFirstStepInputTokens)} | ${delta ? formatNullable(delta.openCodeInputGrowthTokens) : 'unavailable'} | ${delta ? formatNullable(delta.externalGrowthBeyondBrepiaEstimateTokens) : 'unavailable'} |`,
    );
  }

  lines.push('', '## Classification inputs', '');
  if (report.status === 'incompatible_turn_series') {
    lines.push(
      '- Brepia-side dominant turn growth: **not classifiable — model or transport changed inside the capture**.',
    );
  } else if (report.brepiaSideDominantTurnGrowth.length === 0) {
    lines.push(
      report.status === 'insufficient_consecutive_turns'
        ? '- Brepia-side dominant turn growth: **not classifiable — fewer than two captured turns**.'
        : '- Brepia-side dominant turn growth: **no positive measured turn-to-turn growth after excluding one-time current-BRep activation**.',
    );
  } else {
    lines.push(
      `- Brepia-side dominant measured turn growth: ${report.brepiaSideDominantTurnGrowth
        .map(
          (entry) =>
            `**${entry.name}** (${entry.estimatedGrowthTokens} estimated tokens)`,
        )
        .join(', ')}.`,
    );
  }

  lines.push(
    `- One-time current canonical BRep activation: ${report.oneTimeCurrentBrepActivationTokens} estimated tokens; this is authoritative working state, not historical duplication.`,
  );

  const latestProjection = latest?.providerProjection;
  lines.push(
    `- Latest persisted historical BRep tool payload estimate: ${formatNullable(latest?.historicalBrepToolPayloadEstimatedTokens)} tokens; provider projection applied: **${formatNullable(latestProjection?.applied)}**; removed historical tool input/output bytes: ${formatNullable(latestProjection?.removedToolInputBytes)}/${formatNullable(latestProjection?.removedToolOutputBytes)}.`,
  );

  if (report.externalSessionUsage.status === 'unavailable') {
    lines.push(
      '- External OpenCode session usage: **unavailable** — runtime did not report token usage; this is not zero.',
    );
  } else {
    lines.push(
      `- External OpenCode first-step usage: **reported**; turn-to-turn growth available: **${report.externalSessionUsage.growthAvailable}**; positive input-token growth observed: **${report.externalSessionUsage.positiveInputGrowthObserved}**.`,
    );
    if (report.externalSessionUsage.growthAvailable) {
      lines.push(
        `- OpenCode input growth by turn: ${report.externalSessionUsage.inputGrowthTokens.join(', ')} tokens; growth beyond Brepia's schema-free estimate: ${report.externalSessionUsage.externalGrowthBeyondBrepiaEstimateTokens.join(', ')} tokens. Treat the latter as a diagnostic residual, not an exact tokenizer-equivalent decomposition.`,
      );
    }
  }

  lines.push('', ...formatEvidenceRunMarkdown(report.latestRun));
  lines.push(
    '',
    '> Turn-to-turn classification is the primary G2 boundary for normal successful Native BRep edits because those turns are expected to stop after the first accepted build. Internal step deltas remain useful when bounded repair actually occurs. Static provider schemas are reported separately and are not treated as OpenCode transport cost.',
  );

  return `${lines.join('\n')}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const path = args.find((arg) => !arg.startsWith('--'));
  if (!path) {
    console.error(
      'Usage: node scripts/analyze-brep-g2-context.mjs <evidence.jsonl> [--json]',
    );
    process.exitCode = 2;
    return;
  }

  const records = parseEvidenceJsonl(readFileSync(path, 'utf8'));
  const report = analyzeEvidenceCapture(records);
  process.stdout.write(
    json ? `${JSON.stringify(report, null, 2)}\n` : formatEvidenceMarkdown(report),
  );
}

const invokedUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : '';
if (import.meta.url === invokedUrl) {
  main();
}
