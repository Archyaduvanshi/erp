import { test, expect } from '@playwright/test';

test('platform admin can verify and replace a school merchant with concurrency and ownership checks', async ({ page }) => {
  let merchant = { merchantId: 'old_merchant', accountId: 10, version: 2, onboardingStatus: 'ACTIVE', paymentsEnabled: true };
  let submitted;
  await page.route('**/api/platform/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/platform', '');
    if (path === '/auth/refresh') return route.fulfill({ json: { role: 'SUPER_ADMIN', accessToken: 'test-token' } });
    if (path.endsWith('/gateway/cashfree/merchant')) {
      if (request.method() === 'PUT') {
        submitted = request.postDataJSON();
        merchant = { ...merchant, merchantId: submitted.merchantId, accountId: 20, version: 0 };
      }
      return route.fulfill({ json: merchant });
    }
    if (path === '/institutes/9') return route.fulfill({ json: { id: 9, instituteName: 'Test School' } });
    if (path.endsWith('/gateway')) return route.fulfill({ json: merchant });
    return route.fulfill({ json: { content: [], page: 0, totalPages: 0, totalElements: 0 } });
  });
  await page.goto('/platform/gateways?instituteId=9');
  await page.getByRole('button', { name: 'Link / Change Merchant ID' }).click();
  await expect(page.getByText('Current Merchant: old_merchant')).toBeVisible();
  await page.getByLabel('Merchant ID', { exact: true }).fill('new_merchant');
  await page.getByLabel('Reason', { exact: true }).fill('School changed its merchant account');
  await expect(page.getByRole('button', { name: 'Verify & Link Merchant' })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Verify & Link Merchant' }).click();
  await expect(page.getByText('Merchant: new_merchant', { exact: true })).toBeVisible();
  expect(submitted).toEqual({ merchantId: 'new_merchant', reason: 'School changed its merchant account', confirmSchoolOwnership: true, expectedAccountId: 10, expectedVersion: 2 });
});
