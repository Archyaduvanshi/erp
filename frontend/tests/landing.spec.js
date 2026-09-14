import { test, expect } from '@playwright/test';

const config = { registrationEnabled: true, supportEmail: 'support@example.test', supportPhone: '+91 9876543210' };
const plans = [{ publicCode: 'BASIC', name: 'Basic', monthlyPrice: 1200, yearlyPrice: 12000, trialDays: 14, maxStudents: 500, maxTeachers: 40, features: ['Student Management', 'Attendance', 'Fees'] }, { publicCode: 'CUSTOM', name: 'Custom', monthlyPrice: 3000, yearlyPrice: 30000, trialDays: 0, maxStudents: null, maxTeachers: 100, features: ['Reports', 'Library'] }];
async function publicRoutes(page, overrides = {}) {
  const requests = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    expect(route.request().headers().authorization).toBeUndefined();
    if (path === '/api/public/config') return route.fulfill({ json: overrides.config || config });
    if (path === '/api/public/plans') return route.fulfill({ status: overrides.planStatus || 200, json: overrides.plans || plans });
    if (path === '/api/public/demo-requests') return route.fulfill({ status: overrides.demoStatus || 202, json: { message: overrides.demoStatus ? 'Unable to save request.' : 'Received' } });
    return route.fulfill({ status: 401, json: { message: 'Unexpected private request' } });
  });
  return requests;
}

for (const width of [320, 375, 768, 1440]) {
  test(`homepage is usable without overflow at ${width}px`, async ({ page }) => {
    const requests = await publicRoutes(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Smart School & College Management');
    await expect(page.locator('#pricing').getByRole('heading', { name: 'Basic', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('a[href^="/platform"]')).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    expect([...new Set(requests)].sort()).toEqual(['/api/public/config', '/api/public/plans']);
    const invalidAnchors = await page.locator('a[href*="#"]').evaluateAll(links => links.map(link => link.hash.slice(1)).filter(id => id && !document.getElementById(id)));
    expect(invalidAnchors).toEqual([]);
    if (width === 1440) await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true });
    if (width === 375) await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
  });
}

test('mobile menu traps focus and closes on Escape, backdrop and navigation', async ({ page }) => {
  await publicRoutes(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation menu' });
  const menu = page.getByRole('dialog', { name: 'Navigation menu' });
  await trigger.click();
  await expect(menu).toBeVisible();
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); expect(await menu.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(5, 400);
  await expect(menu).not.toBeVisible();
  await trigger.click();
  await menu.getByRole('link', { name: 'Features', exact: true }).click();
  await expect(page).toHaveURL(/#features$/);
  await expect(menu).not.toBeVisible();
});

test('keyboard skip link and FAQ disclosure work', async ({ page }) => {
  await publicRoutes(page); await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  const faq = page.locator('#faq summary').first();
  await faq.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#faq details').first()).toHaveAttribute('open', '');
});

test('pricing switches monthly/yearly and retains real limits', async ({ page }) => {
  await publicRoutes(page); await page.goto('/');
  const plan = page.locator('.landing-plan').first();
  await expect(plan.locator('.landing-plan-price')).toContainText('1,200');
  await page.getByRole('button', { name: 'Yearly', exact: true }).click();
  await expect(plan.locator('.landing-plan-price')).toContainText('12,000');
  await expect(plan).toContainText('500');
  await expect(page.locator('.landing-plan').last()).toContainText('Contact us for capacity');
});

for (const [name, overrides] of [['error', { planStatus: 503 }], ['empty', { plans: [] }]]) {
  test(`plans ${name} state leaves page and demo usable`, async ({ page }) => {
    await publicRoutes(page, overrides); await page.goto('/');
    await expect(page.locator('#pricing')).toContainText('Contact us for plan details');
    await expect(page.locator('#contact').getByRole('button', { name: 'Request Demo' })).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });
}

test('pricing loading skeleton does not block hero', async ({ page }) => {
  await publicRoutes(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/public/plans', async route => { await gate; await route.fulfill({ json: plans }); });
  await page.goto('/');
  await expect(page.getByRole('status', { name: 'Loading plans' })).toBeVisible();
  await expect(page.locator('h1')).toBeVisible(); release();
  await expect(page.getByRole('status', { name: 'Loading plans' })).toHaveCount(0);
});

test('registration disabled redirects trial CTAs to demo and guards direct registration', async ({ page }) => {
  const requests = await publicRoutes(page, { config: { ...config, registrationEnabled: false } });
  await page.goto('/');
  await expect(page.locator('.landing-hero .primary')).toHaveText('Request Demo');
  await expect(page.locator('.landing-hero .primary')).toHaveAttribute('href', '/#contact');
  await page.goto('/register');
  await expect(page.getByText('Online registration is currently paused.', { exact: false })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(requests.every(path => path.startsWith('/api/public/'))).toBe(true);
});

test('trial and login links reach existing routes', async ({ page }) => {
  await publicRoutes(page); await page.goto('/');
  await page.locator('.landing-hero').getByRole('link', { name: 'Start Free Trial' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await page.goto('/');
  await page.locator('.landing-login').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

async function fillDemo(page) {
  const form = page.locator('#contact form');
  await form.getByLabel('Your name').fill('Demo Visitor');
  await form.getByLabel('Institute name').fill('Sample Institution');
  await form.getByLabel('Email', { exact: false }).fill('visitor@example.test');
  await form.getByLabel('Phone').fill('+91 9876543210');
  await form.getByLabel('Institute type').selectOption('School');
  await form.getByLabel('Approximate students').fill('250');
  return form;
}
test('demo validates required fields and sends a single public submission', async ({ page }) => {
  const requests = await publicRoutes(page); await page.goto('/');
  const button = page.locator('#contact').getByRole('button', { name: 'Request Demo' });
  await button.click();
  expect(requests).not.toContain('/api/public/demo-requests');
  await fillDemo(page); await button.click();
  await expect(page.getByRole('status')).toContainText('Your demo request is received');
  expect(requests.filter(path => path === '/api/public/demo-requests')).toHaveLength(1);
});

for (const status of [429, 503]) {
  test(`demo HTTP ${status} error preserves entered details`, async ({ page }) => {
    await publicRoutes(page, { demoStatus: status }); await page.goto('/');
    const form = await fillDemo(page); await form.getByRole('button', { name: 'Request Demo' }).click();
    await expect(form.getByRole('alert')).toContainText(status === 429 ? 'Too many requests' : 'Unable to save request');
    await expect(form.getByLabel('Your name')).toHaveValue('Demo Visitor');
    await expect(form.getByRole('button', { name: 'Request Demo' })).toBeEnabled();
  });
}

test('all five product previews work', async ({ page }) => {
  await publicRoutes(page); await page.goto('/');
  for (const screen of ['Dashboard', 'Students', 'Attendance', 'Fees', 'Reports']) {
    const button = page.getByRole('group', { name: 'Choose product preview' }).getByRole('button', { name: screen, exact: true });
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#product-preview-panel')).toBeVisible();
  }
});

test('public metadata, legal pages and reduced motion are supported', async ({ page }) => {
  const requests = await publicRoutes(page); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await expect(page).toHaveTitle('VidyantraErp | School & College ERP Management Software');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /student management/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://erpfrontend-kohl.vercel.app/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og.png$/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  for (const [path, title] of [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service']]) {
    await page.goto(path); await expect(page.locator('h1')).toHaveText(title);
    await expect(page).toHaveTitle(`${title} | VidyantraErp`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://erpfrontend-kohl.vercel.app${path}`);
  }
  expect(requests.every(path => path.startsWith('/api/public/'))).toBe(true);
});
