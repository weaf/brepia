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
    status: rows.length >= 2 ? 'consecutive_steps_available' : 'insufficient_consecutive_steps',
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
    brepiaSideDominantGrowth: rows.length >= 2
      ? dominantContributions(contributions)
      : [],
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

function formatNullable(value) {
  return value === null || value === undefined ? 'unavailable' : String(value);
}

export function formatEvidenceMarkdown(report) {
  const lines = [
    '# Native BRep Phase G2 context-growth evidence',
    '',
    `- Status: **${report.status}**`,
    `- Transport: \`${formatNullable(report.transportKind)}\``,
    `- Model: \`${formatNullable(report.modelId)}\``,
    `- Model budget source: \`${formatNullable(report.modelBudgetSource)}\``,
    `- Conservative estimated input: ${formatNullable(report.staticContext.estimatedInputTokens)} tokens`,
    `- Schema-free estimated input: ${formatNullable(report.staticContext.estimatedInputTokensExcludingProviderToolSchemas)} tokens`,
    `- Provider tool-schema estimate: ${formatNullable(report.staticContext.providerToolSchemaEstimatedTokens)} tokens`,
    `- Hard budget enforced: ${formatNullable(report.staticContext.hardBudgetEnforced)}`,
    '',
    '## Consecutive step deltas',
    '',
    '| Step | Model msg tokens | Δ model | Tool-result tokens | Δ tool results | BRep payload tokens | Δ BRep | Δ residual | OpenCode input | Δ OpenCode input |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const row of report.steps) {
    lines.push(
      `| ${formatNullable(row.stepNumber)} | ${formatNullable(row.modelMessageEstimatedTokens)} | ${formatNullable(row.modelMessageGrowthTokens)} | ${formatNullable(row.toolResultOutputEstimatedTokens)} | ${formatNullable(row.toolResultGrowthTokens)} | ${formatNullable(row.brepToolPayloadEstimatedTokens)} | ${formatNullable(row.brepToolPayloadGrowthTokens)} | ${formatNullable(row.residualModelMessageGrowthTokens)} | ${formatNullable(row.providerUsage?.inputTokens)} | ${formatNullable(row.externalInputGrowthTokens)} |`,
    );
  }

  lines.push('', '## Classification inputs', '');
  if (report.brepiaSideDominantGrowth.length === 0) {
    lines.push(
      report.status === 'insufficient_consecutive_steps'
        ? '- Brepia-side dominant growth: **not classifiable — fewer than two steps**'
        : '- Brepia-side dominant growth: **no positive measured step growth**',
    );
  } else {
    lines.push(
      `- Brepia-side dominant measured growth: ${report.brepiaSideDominantGrowth
        .map(
          (entry) =>
            `**${entry.name}** (${entry.estimatedGrowthTokens} estimated tokens)`,
        )
        .join(', ')}`,
    );
  }

  if (report.externalSessionUsage.status === 'unavailable') {
    lines.push(
      '- External OpenCode session usage: **unavailable** — runtime did not report token usage; this is not zero.',
    );
  } else {
    lines.push(
      `- External OpenCode session usage: **reported**; positive input-token growth observed: **${report.externalSessionUsage.positiveInputGrowthObserved}**.`,
    );
  }

  lines.push(
    '',
    '> This report classifies measured deltas only. Static provider schemas and transport/system instructions are reported separately and are not mislabeled as step-to-step growth.',
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
  const runs = segmentEvidenceRuns(records);
  if (runs.length === 0) {
    throw new Error('No ai context diagnostics record found in G2 evidence file');
  }
  const report = analyzeEvidenceRun(runs.at(-1));
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
