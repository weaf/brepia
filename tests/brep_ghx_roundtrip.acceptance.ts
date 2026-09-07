import { Buffer } from 'node:buffer';
import { expect, test, type Download, type Page } from '@playwright/test';

const ORIGIN = (process.env.BREPIA_ACCEPTANCE_ORIGIN ?? 'http://localhost:3002').replace(/\/+$/, '');
const IDENTIFIER =
  process.env.BREP_GHX_IDENTIFIER ??
  process.env.BREP_GHX_EMAIL ??
  process.env.B9_EMAIL;
const PASSWORD = process.env.BREP_GHX_PASSWORD ?? process.env.B9_PASSWORD;

if (!IDENTIFIER || !PASSWORD) {
  throw new Error(
    'Set BREP_GHX_IDENTIFIER/BREP_GHX_PASSWORD (BREP_GHX_EMAIL or B9_EMAIL/B9_PASSWORD remain supported) before running the Phase 8H browser acceptance.',
  );
}

const PROMPT = [
  'Create a native BRep project named GHX Round Trip Box.',
  'Use exactly one box node as the project result.',
  'Publish numeric parameter id width, label Width, default 1200 mm, min 600, max 1800, step 100.',
  'Publish numeric parameter id height, label Height, default 2100 mm, min 1500, max 2400, step 100.',
  'The box dimensions must use width for X, literal 600 mm for Y, and height for Z.',
  'Do not add transforms, cylinders, subtracts, fillets, auxiliary semantic geometry, or placement changes.',
].join(' ');

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
    throw new Error(`Phase 8H sign-in failed: ${message}`);
  }
}

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function widthInput(page: Page) {
  return page
    .locator('label')
    .filter({ hasText: /^\s*Width\s*/i })
    .locator('input[type="number"]')
    .first();
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

test('prompt -> Brepia preview -> GHX export -> parameter edit -> GHX import -> activate revision', async ({
  page,
}) => {
  await signIn(page);

  await page.goto(`${ORIGIN}/brep`);
  await expect(
    page.getByRole('heading', { name: 'Create native BRep with AI' }),
  ).toBeVisible();

  await page
    .getByPlaceholder('Describe the native parametric model you want to create…')
    .fill(PROMPT);
  await page.getByRole('button', { name: 'Create with AI' }).click();

  await page.waitForURL(/\/brep\/[0-9a-f-]+$/i, { timeout: 180000 });
  await expect(page.getByText('Parameters', { exact: true })).toBeVisible({
    timeout: 60000,
  });

  const width = widthInput(page);
  await expect(width).toHaveValue('1200', { timeout: 60000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120000 });

  const revisionButtonsBefore = await ensureRevisionHistoryOpen(page);
  const revisionCountBefore = await revisionButtonsBefore.count();
  expect(revisionCountBefore).toBeGreaterThan(0);

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

  const widthMarker =
    '<item name="Value" type_name="gh_double" type_code="6">1200</item>';
  const changedWidthMarker =
    '<item name="Value" type_name="gh_double" type_code="6">1500</item>';
  expect(ghx).toContain(widthMarker);
  const editedGhx = ghx.replace(widthMarker, changedWidthMarker);
  expect(editedGhx).not.toBe(ghx);

  await page.getByLabel('Import Grasshopper GHX').setInputFiles({
    name: 'ghx-round-trip-box-edited.ghx',
    mimeType: 'application/xml',
    buffer: Buffer.from(editedGhx, 'utf8'),
  });

  const importStatus = page
    .getByText(/Imported 1 GHX parameter change as a new revision\./)
    .first();
  await expect(importStatus).toHaveText(
    /Imported 1 GHX parameter change as a new revision\./,
    { timeout: 30000 },
  );

  const revisionButtonsAfter = await ensureRevisionHistoryOpen(page);
  await expect(revisionButtonsAfter).toHaveCount(revisionCountBefore + 1);

  const importedRevision = revisionButtonsAfter.first();
  await expect(importedRevision).not.toContainText('Active');
  await importedRevision.click();
  await expect(importedRevision).toContainText('Active', { timeout: 30000 });

  await expect(widthInput(page)).toHaveValue('1500', { timeout: 30000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120000 });

  await page.screenshot({
    path: 'brep-ghx-roundtrip-accepted.png',
    fullPage: false,
  });
});