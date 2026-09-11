import { test, expect } from '@playwright/test';

const originalPlan = { id: 1, code: 'FLEX', name: 'Flexible Plan', monthlyPrice: 2999, yearlyPrice: 29999, maxStudents: 0, maxTeachers: 50, maxUsers: null, maxStorageMb: 5120, trialDays: 15, status: 'ACTIVE', features: ['FEES'], version: 0 };
const registry = [{ code: 'FEES', displayName: 'Fees' }, { code: 'LIBRARY', displayName: 'Library' }];

async function fixture(page) {
  const state = { plans: [{ ...originalPlan }], requests: [], assignments: [], history: [], count: 51 };
  await page.route('**/api/platform/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/platform', '');
    const method = request.method();
    state.requests.push({ path, method, search: url.search });
    const json = value => route.fulfill({ json: value });
    if (path === '/auth/refresh') return json({ role: 'SUPER_ADMIN', displayName: 'Test Admin', accessToken: 'test-token' });
    if (path === '/plans' && method === 'GET') return json(state.plans);
    if (path === '/plans' && method === 'POST') {
      const body = request.postDataJSON();
      if (state.plans.some(p => p.code === body.code)) return route.fulfill({ status: 409, json: { message: 'PLAN_ALREADY_EXISTS' } });
      const plan = { ...body, id: state.plans.length + 1, version: 0 };
      state.plans.push(plan); return json(plan);
    }
    if (/^\/plans\/\d+$/.test(path) && method === 'PUT') {
      const body = request.postDataJSON();
      const index = state.plans.findIndex(p => p.id === Number(path.split('/')[2]));
      state.plans[index] = { ...body, version: state.plans[index].version + 1 };
      return json(state.plans[index]);
    }
    if (/^\/plans\/\d+\/status$/.test(path)) {
      const plan = state.plans.find(p => p.id === Number(path.split('/')[2]));
      Object.assign(plan, { status: request.postDataJSON().status, version: plan.version + 1 }); return json(plan);
    }
    if (path === '/features/options') return json(registry);
    if (path === '/subscriptions/summary') return json({ activeSubscriptions: 2, trialInstitutes: 1, expiringIn7Days: 1, expiringIn30Days: 2 });
    if (path === '/subscriptions') {
      const page = Number(url.searchParams.get('page') || 0), size = Number(url.searchParams.get('size') || 25);
      return json({ content: [{ id: page + 1, instituteId: 9, instituteName: `Test School ${page + 1}`, institutionCode: 'TS9', planId: 1, planName: 'Flexible Plan', status: 'ACTIVE', billingCycle: 'MONTHLY', startDate: '2026-09-01', endDate: '2026-09-30', amount: 2999 }], page, size, totalPages: Math.ceil(state.count / size), totalElements: state.count });
    }
    if (path === '/institutes/9') return json({ id: 9, instituteName: 'Test School', institutionCode: 'TS9', type: 'School', status: 'ACTIVE', currentPlan: 'Flexible Plan', subscriptionStatus: 'ACTIVE' });
    if (path === '/institutes/9/subscriptions' && method === 'GET') return json(state.history);
    if (path === '/institutes/9/subscriptions' && method === 'POST') {
      const body = request.postDataJSON(); state.assignments.push(body);
      const subscription = { ...body, id: 1, planName: 'Flexible Plan', currency: 'INR', version: 0 };
      state.history.unshift(subscription); return json(subscription);
    }
    if (path === '/institutes/9/usage') return json({ students: 0, maxStudents: 0, teachers: 2, maxTeachers: 50, activeAccounts: 3, maxUsers: null });
    return route.fulfill({ status: 404, json: { message: `Unexpected test endpoint ${path}` } });
  });
  return state;
}

test('plans open without directory/entity preload and render zero correctly', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/platform/subscriptions');
  await expect(page.getByRole('heading', { name: 'Flexible Plan', exact: true })).toBeVisible();
  await expect(page.getByText('0 students', { exact: true })).toBeVisible();
  await expect(page.getByText('Unlimited active users', { exact: true })).toBeVisible();
  expect(state.requests.every(r => ['/auth/refresh', '/plans', '/subscriptions/summary'].includes(r.path))).toBeTruthy();
  await page.screenshot({ path: 'test-results/subscriptions-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Create Plan', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/subscriptions-mobile.png', fullPage: true });
});

test('create, edit features and activate/deactivate a database-driven plan', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/platform/subscriptions');
  await page.getByRole('button', { name: 'Create Plan', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Plan Code *', { exact: true }).fill('custom');
  await dialog.getByLabel('Plan Name *', { exact: true }).fill('Custom Plan');
  await dialog.getByLabel('Monthly Price (INR)').fill('4999.50');
  await dialog.getByLabel('Yearly Price (INR)').fill('49999');
  await dialog.getByLabel('Fees', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Save Plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Custom Plan', exact: true })).toBeVisible();
  expect(state.plans[1].code).toBe('CUSTOM');expect(state.plans[1].maxStudents).toBeNull();
  expect(state.requests.filter(r => r.path.startsWith('/institutes'))).toHaveLength(0);
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Custom Plan', exact: true }) });
  await card.getByRole('button', { name: 'Manage Features' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Plan Code *', { exact: true })).toBeDisabled();
  await dialog.getByLabel('Library', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Save Plan', exact: true }).click();
  await expect(card.getByText('2 features')).toBeVisible();
  await card.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Reason', { exact: true }).fill('Retiring this plan');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(card.getByRole('button', { name: 'Activate', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Activate', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Reason', { exact: true }).fill('Available again');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(card.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible();
});

test('directory uses server filters, page size and dynamic plan choices', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/platform/subscriptions');
  await page.getByRole('tab', { name: 'Institute Subscriptions' }).click();
  await page.getByLabel('Plan', { exact: true }).selectOption('FLEX');
  await expect(page.getByText('Test School 1', { exact: true })).toBeVisible();
  await page.getByLabel('Rows per page', { exact: true }).selectOption('50');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Test School 2', { exact: true })).toBeVisible();
  expect(state.requests.some(r => r.path === '/subscriptions' && r.search.includes('plan=FLEX') && r.search.includes('page=1') && r.search.includes('size=50'))).toBeTruthy();
  await page.getByLabel('Billing Cycle', { exact: true }).selectOption('YEARLY');
  await expect(page.getByText('Test School 1', { exact: true })).toBeVisible();
});

test('assignment auto-fills prices, excludes inactive plans and requires reason', async ({ page }) => {
  const state = await fixture(page);
  state.plans.push({ ...originalPlan, id: 2, code: 'OLD', name: 'Retired Plan', status: 'INACTIVE' });
  await page.goto('/platform/institutes/9?tab=Subscription');
  await page.getByRole('button', { name: 'Assign / Change Plan', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('option', { name: 'Retired Plan (OLD)' })).toHaveCount(0);
  await expect(dialog.getByLabel('Amount (INR) *', { exact: true })).toHaveValue('2999');
  await dialog.getByLabel('Billing Cycle', { exact: true }).selectOption('YEARLY');
  await expect(dialog.getByLabel('Amount (INR) *', { exact: true })).toHaveValue('29999');
  await dialog.getByLabel('Amount (INR) *', { exact: true }).fill('25000');
  await expect(dialog.getByRole('button', { name: 'Save Subscription' })).toBeDisabled();
  await dialog.getByLabel('Reason *', { exact: true }).fill('Annual negotiated price');
  await dialog.getByRole('button', { name: 'Save Subscription' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.assignments[0].amount).toBe('25000');
  expect(state.assignments[0].currentSubscriptionId).toBeNull();
  expect(state.requests.filter(r => r.path === '/institutes/9/usage')).toHaveLength(2);
});
