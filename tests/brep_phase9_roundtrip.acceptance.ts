import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Download, type Page } from '@playwright/test';

const ORIGIN = (process.env.BREPIA_ACCEPTANCE_ORIGIN ?? 'http://localhost:3000').replace(/\/+$/, '');
const IDENTIFIER =
  process.env.BREP_GHX_IDENTIFIER ??
  process.env.BREP_GHX_EMAIL ??
  process.env.B9_EMAIL;
const PASSWORD = process.env.BREP_GHX_PASSWORD ?? process.env.B9_PASSWORD;
const STAGE = process.env.BREPIA_PHASE9_STAGE;
const OUTPUT_DIR = path.resolve(
  process.env.BREPIA_PHASE9_DIR ?? 'test-results/phase9-roundtrip',
);
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const SOURCE_GHX_PATH = path.join(OUTPUT_DIR, 'phase9-source.ghx');
const DEFAULT_RETURNED_GHX_PATH = path.join(
  OUTPUT_DIR,
  'phase9-host-saved.ghx',
);
const CONTINUED_GHX_PATH = path.join(OUTPUT_DIR, 'phase9-continued.ghx');

if (!IDENTIFIER || !PASSWORD) {
  throw new Error(
    'Set BREP_GHX_IDENTIFIER/BREP_GHX_PASSWORD (BREP_GHX_EMAIL or B9_EMAIL/B9_PASSWORD remain supported) before running Phase 9 browser acceptance.',
  );
}

if (STAGE !== 'prepare' && STAGE !== 'finalize') {
  throw new Error(
    'Set BREPIA_PHASE9_STAGE=prepare or BREPIA_PHASE9_STAGE=finalize before running Phase 9 browser acceptance.',
  );
}

const PROMPT = [
  'Create a native BRep project named Phase 9 Round Trip Box.',
  'Use exactly one box node as the project result.',
  'Publish numeric parameter id width, label Width, default 1200 mm, min 600, max 1800, step 100.',
  'Publish numeric parameter id height, label Height, default 2100 mm, min 1500, max 2400, step 100.',
  'The box dimensions must use width for X, literal 600 mm for Y depth, and height for Z.',
  'Do not add transforms, cylinders, subtracts, fillets, auxiliary semantic geometry, or placement changes.',
].join(' ');

const CONTINUATION_PROMPT = [
  'Continue the current native BRep model.',
  'Change only the literal box Y/depth dimension from 600 mm to 700 mm.',
  'Preserve the existing width and height published parameter ids, bounds, and current values.',
  'Keep exactly one box as the result and do not add parameters or nodes.',
].join(' ');

type Phase9Manifest = {
  schemaVersion: 1;
  conversationUrl: string;
  conversationId: string;
  sourceGhx: string;
  expectedHostEdit: {
    width: 1500;
    height: 2300;
  };
  expectedContinuationDepth: 700;
  preparedAt: string;
  returnedGhx?: string;
  continuedGhx?: string;
  finalizedAt?: string;
};

async function waitForReactHydration(page: Page) {
  await page.locator('#identifier').waitFor({ state: 'visible', timeout: 30000 });
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
    { timeout: 30000 },
  );
}

async function signIn(page: Page) {
  await page.goto(`${ORIGIN}/signin`);
  await waitForReactHydration(page);
  await page.locator('#identifier').fill(IDENTIFIER!);
  await page.locator('#password').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  const authError = page
    .getByText(/Invalid username\/email or password|An error occurred while signing in/)
    .first();

  await expect
    .poll(
      async () => {
        if (new URL(page.url()).pathname !== '/signin') return true;
        return authError.isVisible().catch(() => false);
      },
      { timeout: 30000 },
    )
    .toBe(true);

  if (await authError.isVisible().catch(() => false)) {
    const message =
      (await authError.textContent())?.trim() || 'unknown authentication error';
    throw new Error(`Phase 9 sign-in failed: ${message}`);
  }
}

function parameterInput(page: Page, label: string) {
  return page.getByLabel(`${label} value`, { exact: true });
}

function widthInput(page: Page) {
  return parameterInput(page, 'Width');
}

function heightInput(page: Page) {
  return parameterInput(page, 'Height');
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
      { timeout: 30000 },
    )
    .toBe(0);
}

async function waitForBrepEditorReady(page: Page) {
  const parameters = page.getByText('Parameters', { exact: true });
  const terminalCreation = page
    .getByRole('heading', {
      name: /Native BRep creation (?:failed|stopped)/,
    })
    .first();

  const timeout = 180000;
  const outcome = await Promise.race([
    parameters
      .waitFor({ state: 'visible', timeout })
      .then(() => 'ready' as const),
    terminalCreation
      .waitFor({ state: 'visible', timeout })
      .then(() => 'terminal' as const),
  ]);

  if (outcome === 'ready') return;

  const durableStage =
    (await page
      .locator('[aria-live="polite"]')
      .first()
      .textContent()
      .catch(() => null))?.trim() ?? 'none';
  throw new Error(
    `Phase 9 BRep creation reached a terminal failure before the editor became ready. URL=${page.url()} durableStage=${JSON.stringify(durableStage)}.`,
  );
}

async function waitForExistingBrepWorkspace(page: Page) {
  await expect(page.getByText('Parameters', { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120000 });
}

async function ensureRevisionHistoryOpen(page: Page) {
  const revisionButtons = page
    .getByRole('button')
    .filter({ hasText: /^Revision \d+/ });
  if ((await revisionButtons.count()) > 0) return revisionButtons;
  await page.getByRole('button', { name: /Revision history/i }).click();
  await expect(revisionButtons.first()).toBeVisible();
  return revisionButtons;
}

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function exportGhx(page: Page, destination: string): Promise<string> {
  await page.getByRole('button', { name: 'select BRep download format' }).click();
  await page.getByText('.GHX', { exact: true }).click();
  const downloadButton = page.getByRole('button', { name: 'download GHX file' });
  await expect(downloadButton).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadButton.click(),
  ]);
  expect(download.suggestedFilename().toLowerCase()).toMatch(/\.ghx$/);

  const ghx = await downloadText(download);
  expect(ghx).toContain('<Archive');
  expect(ghx).toContain('Brepia');
  await download.saveAs(destination);
  return ghx;
}

function embeddedRhinoScriptSource(ghx: string): string {
  const encoded = ghx.match(
    /<item name="Text" type_name="gh_string" type_code="10">([A-Za-z0-9+/=]+)<\/item>/,
  )?.[1];
  if (!encoded) {
    throw new Error('Generated GHX is missing the embedded Brepia Rhino Python source.');
  }
  return Buffer.from(encoded, 'base64').toString('utf8');
}

async function readManifest(): Promise<Phase9Manifest> {
  const parsed = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Phase9Manifest;
  if (
    parsed.schemaVersion !== 1 ||
    typeof parsed.conversationUrl !== 'string' ||
    typeof parsed.conversationId !== 'string'
  ) {
    throw new Error(`Invalid Phase 9 manifest at ${MANIFEST_PATH}.`);
  }
  return parsed;
}

test.describe('BRep Phase 9 full product round-trip', () => {
  test('prepare current-product GHX for installed Rhino 8', async ({ page }) => {
    test.skip(STAGE !== 'prepare', 'Run with BREPIA_PHASE9_STAGE=prepare.');
    await mkdir(OUTPUT_DIR, { recursive: true });
    await signIn(page);
    await page.goto(`${ORIGIN}/`);

    const nativeBrepButton = page.getByRole('button', {
      name: 'Native BRep',
      exact: true,
    });
    await expect(nativeBrepButton).toBeVisible();
    await nativeBrepButton.click();
    await expect(nativeBrepButton).toHaveAttribute('aria-pressed', 'true');
    await waitForConfiguredParametricModel(page);

    const generationRunRead = page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        request.url().includes('/rest/v1/generation_runs'),
      { timeout: 30000 },
    );
    const promptInput = page.locator('textarea').first();
    await promptInput.fill(PROMPT);
    await promptInput.press('Enter');
    await generationRunRead;

    await page.waitForURL(/\/brep\/[0-9a-f-]+$/i, { timeout: 180000 });
    await waitForBrepEditorReady(page);
    await expect(widthInput(page)).toHaveValue('1200', { timeout: 60000 });
    await expect(heightInput(page)).toHaveValue('2100', { timeout: 60000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120000 });

    const sourceGhx = await exportGhx(page, SOURCE_GHX_PATH);
    expect(embeddedRhinoScriptSource(sourceGhx)).toContain(
      'brepiaNode0Depth = float(600)',
    );
    expect(sourceGhx).toContain(
      '<item name="Value" type_name="gh_double" type_code="6">1200</item>',
    );
    expect(sourceGhx).toContain(
      '<item name="Value" type_name="gh_double" type_code="6">2100</item>',
    );

    const conversationUrl = page.url();
    const conversationId = new URL(conversationUrl).pathname.split('/').at(-1);
    if (!conversationId) throw new Error('Could not resolve Phase 9 conversation id.');

    const manifest: Phase9Manifest = {
      schemaVersion: 1,
      conversationUrl,
      conversationId,
      sourceGhx: SOURCE_GHX_PATH,
      expectedHostEdit: { width: 1500, height: 2300 },
      expectedContinuationDepth: 700,
      preparedAt: new Date().toISOString(),
    };
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'phase9-prepare.png'),
      fullPage: false,
    });

    console.log(
      JSON.stringify({
        phase9Stage: 'prepared',
        conversationId,
        sourceGhx: SOURCE_GHX_PATH,
        saveHostReturnedAs: DEFAULT_RETURNED_GHX_PATH,
        hostEdit: manifest.expectedHostEdit,
      }),
    );
  });

  test('import real Rhino-saved GHX, continue with AI, and export fresh GHX', async ({
    page,
  }) => {
    test.skip(STAGE !== 'finalize', 'Run with BREPIA_PHASE9_STAGE=finalize.');
    await mkdir(OUTPUT_DIR, { recursive: true });
    const manifest = await readManifest();
    const returnedGhxPath = path.resolve(
      process.env.BREPIA_PHASE9_RETURNED_GHX ?? DEFAULT_RETURNED_GHX_PATH,
    );
    await readFile(returnedGhxPath);

    await signIn(page);
    await page.goto(manifest.conversationUrl);
    await waitForExistingBrepWorkspace(page);
    await expect(widthInput(page)).toHaveValue('1200', { timeout: 30000 });
    await expect(heightInput(page)).toHaveValue('2100', { timeout: 30000 });

    const revisionButtonsBefore = await ensureRevisionHistoryOpen(page);
    const revisionCountBefore = await revisionButtonsBefore.count();

    await page.getByLabel('Import Grasshopper GHX').setInputFiles(returnedGhxPath);
    const importStatus = page
      .getByText(/Imported 2 GHX parameter changes as a new revision\./)
      .first();
    await expect(importStatus).toHaveText(
      /Imported 2 GHX parameter changes as a new revision\./,
      { timeout: 30000 },
    );

    const revisionButtonsAfter = await ensureRevisionHistoryOpen(page);
    await expect(revisionButtonsAfter).toHaveCount(revisionCountBefore + 1);
    const importedRevision = revisionButtonsAfter.first();
    await expect(importedRevision).not.toContainText('Active');
    await importedRevision.click();
    await expect(importedRevision).toContainText('Active', { timeout: 30000 });

    await expect(widthInput(page)).toHaveValue('1500', { timeout: 30000 });
    await expect(heightInput(page)).toHaveValue('2300', { timeout: 30000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120000 });

    const revisionCountAfterImport = await revisionButtonsAfter.count();
    const chatInput = page.getByPlaceholder('Describe the next BRep edit...');
    await expect(chatInput).toBeVisible();
    await chatInput.fill(CONTINUATION_PROMPT);
    await chatInput.press('Enter');

    await expect(revisionButtonsAfter).toHaveCount(revisionCountAfterImport + 1, {
      timeout: 240000,
    });
    const continuedRevision = revisionButtonsAfter.first();
    await expect(continuedRevision).toContainText('Active', { timeout: 30000 });
    await expect(widthInput(page)).toHaveValue('1500', { timeout: 30000 });
    await expect(heightInput(page)).toHaveValue('2300', { timeout: 30000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120000 });

    const continuedGhx = await exportGhx(page, CONTINUED_GHX_PATH);
    expect(embeddedRhinoScriptSource(continuedGhx)).toContain(
      'brepiaNode0Depth = float(700)',
    );
    expect(continuedGhx).toContain(
      '<item name="Value" type_name="gh_double" type_code="6">1500</item>',
    );
    expect(continuedGhx).toContain(
      '<item name="Value" type_name="gh_double" type_code="6">2300</item>',
    );

    const finalizedManifest: Phase9Manifest = {
      ...manifest,
      returnedGhx: returnedGhxPath,
      continuedGhx: CONTINUED_GHX_PATH,
      finalizedAt: new Date().toISOString(),
    };
    await writeFile(
      MANIFEST_PATH,
      `${JSON.stringify(finalizedManifest, null, 2)}\n`,
      'utf8',
    );
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'phase9-finalize.png'),
      fullPage: false,
    });

    console.log(
      JSON.stringify({
        phase9Stage: 'browser-finalized',
        conversationId: manifest.conversationId,
        returnedParameters: manifest.expectedHostEdit,
        aiContinuationDepth: manifest.expectedContinuationDepth,
        continuedGhx: CONTINUED_GHX_PATH,
        remainingHostCheck:
          'Open the continued GHX in installed Rhino 8 / Grasshopper and confirm open/solve plus expected 1500 x 700 x 2300 box geometry.',
      }),
    );
  });
});