import { expect, test, type Page } from '@playwright/test';

const registrationSettings = {
  allowRegistration: true,
  requireAdminApproval: false,
  identityPolicy: 'email_or_social',
  allowedSocialProviders: [],
  bootstrapAvailable: false,
};

async function prepareSignedOutPage(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.removeItem('session');
  });

  await page.route('**/api/delete-user*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('scope') === 'registration') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(registrationSettings),
      });
      return;
    }
    await route.continue();
  });

  return pageErrors;
}

function redirectTarget(page: Page): string | null {
  return new URL(page.url()).searchParams.get('redirect');
}

test.describe('browser smoke', () => {
  test('sign-in surface renders without a client crash', async ({ page }) => {
    const pageErrors = await prepareSignedOutPage(page);

    await page.goto('/signin');

    await expect(page.getByText('Brepia', { exact: true })).toBeVisible();
    await expect(page.getByText('by Noty', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Username or email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign In', exact: true }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('protected deep links redirect once and preserve the return target', async ({
    page,
  }) => {
    const pageErrors = await prepareSignedOutPage(page);

    await page.goto('/settings?tab=models');
    await expect(page).toHaveURL(/\/signin(?:\?|$)/);
    expect(redirectTarget(page)).toBe('/settings?tab=models');
    await expect(page.getByLabel('Username or email')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('legacy /cadam deep links canonicalize before auth redirect', async ({
    page,
  }) => {
    const pageErrors = await prepareSignedOutPage(page);

    await page.goto('/cadam/settings?tab=models');
    await expect(page).toHaveURL(/\/signin(?:\?|$)/);
    expect(redirectTarget(page)).toBe('/settings?tab=models');
    expect(new URL(page.url()).pathname).not.toContain('/cadam');
    expect(pageErrors).toEqual([]);
  });
});
