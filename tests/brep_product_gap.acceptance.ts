import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expect,
  test,
  type Download,
  type Page,
  type Response,
} from '@playwright/test';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity';
import { parseBrepProjectPackageJson } from '../shared/brepProjectPackage';
import { brepProductGapTarget } from './brepProductGapAuditTargets';

const ORIGIN = (
  process.env.BREPIA_GAP_ORIGIN ?? 'http://localhost:3000'
).replace(/\/+$/, '');
const IDENTIFIER =
  process.env.BREPIA_GAP_IDENTIFIER ??
  process.env.BREP_GHX_IDENTIFIER ??
  process.env.B9_EMAIL;
const PASSWORD =
  process.env.BREPIA_GAP_PASSWORD ??
  process.env.BREP_GHX_PASSWORD ??
  process.env.B9_PASSWORD;
const TARGET = brepProductGapTarget(process.env.BREPIA_BREP_GAP_TARGET);
const EXISTING_CONVERSATION_ID =
  process.env.BREPIA_GAP_CONVERSATION_ID?.trim() || null;
const RESUME_MODEL = process.env.BREPIA_GAP_MODEL?.trim() || undefined;
const RESUME_EXECUTION_MODE =
  process.env.BREPIA_GAP_EXECUTION_MODE?.trim() || undefined;
const GENERATION_TIMEOUT_MS = Number(
  process.env.BREPIA_GAP_GENERATION_TIMEOUT_MS ?? 15 * 60_000,
);
const OUTPUT_ROOT = path.resolve(
  process.env.BREPIA_GAP_DIR ?? 'test-results/brep-product-gap',
);
const OUTPUT_DIR = path.join(OUTPUT_ROOT, TARGET.id.toLowerCase());

if (!IDENTIFIER || !PASSWORD) {
  throw new Error(
    'Set BREPIA_GAP_IDENTIFIER/BREPIA_GAP_PASSWORD (BREP_GHX_* or B9_* remain supported) before running the BRep product-gap audit.',
  );
}

type EvaluationSnapshot = {
  status: number;
  resultStatus?: string;
  resultKind?: string;
  bounds?: unknown;
  warnings?: unknown;
};

type AuditManifest = {
  schemaVersion: 1;
  target: {
    id: string;
    name: string;
    question: string;
    prompt: string;
  };
  generatedAt: string;
  origin: string;
  conversationUrl: string;
  conversationId: string | null;
  generationOutcome: 'ready' | 'terminal';
  generationStatusText: string | null;
  transportRequest: {
    model?: string;
    openCodeExecutionMode?: string;
  } | null;
  canonicalProject?: {
    filename: string;
    projectId: string;
    projectName: string;
    resultNodeId: string;
    resultKind: string;
    nodeCount: number;
    nodeTypeHistogram: Record<string, number>;
    publishedParameters: Array<{
      id: string;
      label: string;
      default: number;
      unit: string;
    }>;
    integrity: ReturnType<typeof analyzeBrepProjectIntegrity>;
  };
  evaluations: EvaluationSnapshot[];
  perturbation?: {
    label: string;
    requestedValue: number;
    inputValue: string;
    evaluation: EvaluationSnapshot;
    savedRevision: boolean;
  };
};

async function waitForReactHydration(page: Page) {
  await page
    .locator('#identifier')
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const node = document.querySelector('#identifier');
      return Boolean(
        node &&
        Object.keys(node).some(
          (key) =>
            key.startsWith('__reactFiber$') || key.startsWith('__reactProps$'),
        ),
      );
    },
    undefined,
    { timeout: 30_000 },
  );
}

async function signIn(page: Page) {
  await page.goto(`${ORIGIN}/signin`);
  await waitForReactHydration(page);
  await page.locator('#identifier').fill(IDENTIFIER!);
  await page.locator('#password').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  const authError = page
    .getByText(
      /Invalid username\/email or password|An error occurred while signing in/,
    )
    .first();
  await expect
    .poll(
      async () =>
        new URL(page.url()).pathname !== '/signin' ||
        authError.isVisible().catch(() => false),
      { timeout: 30_000 },
    )
    .toBe(true);
  if (await authError.isVisible().catch(() => false)) {
    throw new Error(
      `BRep product-gap audit sign-in failed: ${(await authError.textContent())?.trim()}`,
    );
  }
}

async function waitForConfiguredParametricModel(page: Page) {
  const promptInput = page.locator('textarea').first();
  await expect(promptInput).toBeVisible();
  await expect
    .poll(
      async () =>
        page
          .getByRole('button')
          .filter({ hasText: '__unconfigured__' })
          .count(),
      { timeout: 30_000 },
    )
    .toBe(0);
}

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function exportCanonicalProject(page: Page) {
  await page
    .getByRole('button', { name: 'select BRep download format' })
    .click();
  await page.getByText('.BREP JSON', { exact: true }).click();
  const downloadButton = page.getByRole('button', {
    name: 'download BREP file',
  });
  await expect(downloadButton).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadButton.click(),
  ]);
  const text = await downloadText(download);
  const filename = `${TARGET.id.toLowerCase()}-canonical.brepia-brep.json`;
  await download.saveAs(path.join(OUTPUT_DIR, filename));
  return { filename, text };
}

function evaluationSnapshot(
  response: Response,
  body: unknown,
): EvaluationSnapshot {
  if (!body || typeof body !== 'object') return { status: response.status() };
  const record = body as Record<string, unknown>;
  return {
    status: response.status(),
    resultStatus: typeof record.status === 'string' ? record.status : undefined,
    resultKind:
      typeof record.resultKind === 'string' ? record.resultKind : undefined,
    bounds: record.bounds,
    warnings: record.warnings,
  };
}

function nodeTypeHistogram(
  nodes: Array<{ type: string }>,
): Record<string, number> {
  const histogram: Record<string, number> = {};
  for (const node of nodes)
    histogram[node.type] = (histogram[node.type] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(histogram).sort(([a], [b]) => a.localeCompare(b)),
  );
}

test(`BRep product-gap audit target ${TARGET.id}: ${TARGET.name}`, async ({
  page,
}) => {
  test.setTimeout(GENERATION_TIMEOUT_MS + 3 * 60_000);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const evaluations: EvaluationSnapshot[] = [];
  let transportRequest: AuditManifest['transportRequest'] =
    EXISTING_CONVERSATION_ID
      ? { model: RESUME_MODEL, openCodeExecutionMode: RESUME_EXECUTION_MODE }
      : null;
  page.on('request', (request) => {
    if (
      request.method() !== 'POST' ||
      !request.url().includes('/api/parametric-chat')
    )
      return;
    try {
      const body = request.postDataJSON() as Record<string, unknown>;
      transportRequest = {
        model: typeof body.model === 'string' ? body.model : undefined,
        openCodeExecutionMode:
          typeof body.openCodeExecutionMode === 'string'
            ? body.openCodeExecutionMode
            : undefined,
      };
    } catch {
      // Evidence remains useful through the visible generation status if this
      // transport implementation changes its body encoding.
    }
  });
  page.on('response', async (response) => {
    if (
      response.request().method() !== 'POST' ||
      !response.url().includes('/api/brep/evaluate')
    )
      return;
    try {
      evaluations.push(evaluationSnapshot(response, await response.json()));
    } catch {
      evaluations.push({ status: response.status() });
    }
  });

  await signIn(page);
  if (EXISTING_CONVERSATION_ID) {
    await page.goto(`${ORIGIN}/brep/${EXISTING_CONVERSATION_ID}`);
  } else {
    await page.goto(`${ORIGIN}/`);

    const nativeBrepButton = page.getByRole('button', {
      name: 'Native BRep',
      exact: true,
    });
    await expect(nativeBrepButton).toBeVisible();
    await nativeBrepButton.click();
    await expect(nativeBrepButton).toHaveAttribute('aria-pressed', 'true');
    await waitForConfiguredParametricModel(page);

    const promptInput = page.locator('textarea').first();
    await promptInput.fill(TARGET.prompt);
    await promptInput.press('Enter');
  }

  const parameters = page.getByText('Parameters', { exact: true });
  const terminalCreation = page
    .getByRole('heading', { name: /Native BRep creation (?:failed|stopped)/ })
    .first();
  const outcome = await Promise.race([
    parameters
      .waitFor({ state: 'visible', timeout: GENERATION_TIMEOUT_MS })
      .then(() => 'ready' as const),
    terminalCreation
      .waitFor({ state: 'visible', timeout: GENERATION_TIMEOUT_MS })
      .then(() => 'terminal' as const),
  ]);

  const generationStatus = page
    .locator('[aria-label="Native BRep generation status"]')
    .first();
  const generationStatusText = await generationStatus
    .textContent()
    .then((value) => value?.replace(/\s+/g, ' ').trim() || null)
    .catch(() => null);
  const conversationUrl = page.url();
  const conversationId =
    /\/brep\/([0-9a-f-]+)$/i.exec(new URL(conversationUrl).pathname)?.[1] ??
    null;

  const manifest: AuditManifest = {
    schemaVersion: 1,
    target: {
      id: TARGET.id,
      name: TARGET.name,
      question: TARGET.question,
      prompt: TARGET.prompt,
    },
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    conversationUrl,
    conversationId,
    generationOutcome: outcome,
    generationStatusText,
    transportRequest,
    evaluations,
  };

  if (outcome === 'terminal') {
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${TARGET.id.toLowerCase()}-terminal.png`),
    });
    await writeFile(
      path.join(OUTPUT_DIR, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    if (!TARGET.allowTerminalWithoutProject) {
      throw new Error(
        `Target ${TARGET.id} reached a terminal creation outcome before producing a canonical project.`,
      );
    }
    return;
  }

  await expect(page.locator('canvas').first()).toBeVisible({
    timeout: 120_000,
  });
  const exported = await exportCanonicalProject(page);
  const packageValue = parseBrepProjectPackageJson(exported.text);
  const project = packageValue.source.source;
  const integrity = analyzeBrepProjectIntegrity(project);
  const resultNode = project.nodes.find(
    (node) => node.id === project.resultNodeId,
  );
  if (!resultNode)
    throw new Error('Canonical audit project is missing its result node.');

  manifest.canonicalProject = {
    filename: exported.filename,
    projectId: project.id,
    projectName: project.name,
    resultNodeId: project.resultNodeId,
    resultKind: project.resultKind,
    nodeCount: project.nodes.length,
    nodeTypeHistogram: nodeTypeHistogram(project.nodes),
    publishedParameters: project.parameters.map((parameter) => ({
      id: parameter.id,
      label: parameter.label,
      default: parameter.default,
      unit: parameter.unit,
    })),
    integrity,
  };

  expect(integrity.orphanOnlyParameterIds).toEqual([]);
  expect(integrity.unusedParameterIds).toEqual([]);
  expect(integrity.orphanNodeIds).toEqual([]);

  const input = page.getByLabel(`${TARGET.perturbation.label} value`, {
    exact: true,
  });
  await expect(input).toBeVisible();
  const perturbationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/brep/evaluate') &&
      response.status() === 200,
    { timeout: 120_000 },
  );
  await input.fill(String(TARGET.perturbation.value));
  const response = await perturbationResponse;
  const responseBody: unknown = await response.json();
  const perturbationEvaluation = evaluationSnapshot(response, responseBody);
  await expect(input).toHaveValue(String(TARGET.perturbation.value));
  await expect(page.locator('canvas').first()).toBeVisible({
    timeout: 120_000,
  });

  const saveButton = page.getByRole('button', {
    name: 'Save parameter revision',
    exact: true,
  });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(
    page.getByRole('button', { name: 'Parameters saved', exact: true }),
  ).toBeVisible({
    timeout: 60_000,
  });

  manifest.perturbation = {
    label: TARGET.perturbation.label,
    requestedValue: TARGET.perturbation.value,
    inputValue: await input.inputValue(),
    evaluation: perturbationEvaluation,
    savedRevision: true,
  };
  manifest.evaluations = evaluations;

  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${TARGET.id.toLowerCase()}-perturbed.png`),
    fullPage: false,
  });
  await writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
});
