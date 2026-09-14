import { test, expect } from '@playwright/test';

test('Send OTP stays inside email field on desktop and mobile', async ({ page }) => {
  await page.goto('/forgot-password');
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const email = page.getByPlaceholder('Your account email');
    await email.fill('');
    await email.pressSequentially('student@example.com');
    await expect(email).toBeFocused();
    const field = await email.boundingBox();
    const button = await page.getByRole('button', { name: 'Send OTP', exact: true }).boundingBox();
    expect(button.x).toBeGreaterThan(field.x);
    expect(button.x + button.width).toBeLessThanOrEqual(field.x + field.width);
    expect(button.y).toBeGreaterThanOrEqual(field.y);
    expect(button.y + button.height).toBeLessThanOrEqual(field.y + field.height);
  }
});

test('recovery verifies inline OTP and carries proof to reset request', async ({ page }) => {
  let sent;
  let proofHeader;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/email/send')) {
      sent = route.request().postDataJSON();
      return route.fulfill({ json: { challengeId: 'challenge', expiresIn: 300, resendAfter: 60 } });
    }
    if (path.endsWith('/auth/email/verify')) {
      const body = route.request().postDataJSON();
      if (body.otp !== '123456') return route.fulfill({ status: 400, json: { message: 'Incorrect OTP.' } });
      return route.fulfill({ json: { proof: 'test-proof', expiresIn: 1800 } });
    }
    if (path.endsWith('/auth/password/forgot')) {
      expect(route.request().postDataJSON()).toEqual({ username: 'STU01', email: 'student@example.com' });
      proofHeader = route.request().headers()['x-email-verification'];
      return route.fulfill({ json: { message: 'Verified', resetToken: 'reset-capability' } });
    }
    return route.fulfill({ status: 401, json: { message: 'Not logged in' } });
  });
  await page.goto('/forgot-password');
  await expect(page.getByText('Institution Code', { exact: true })).toHaveCount(0);
  await page.getByPlaceholder('EMP0001 or STU0001').fill('STU01');
  await page.getByPlaceholder('Your account email').fill('student@example.com');
  await page.getByRole('button', { name: 'Send OTP', exact: true }).click();
  expect(sent).toEqual({ email: 'student@example.com', purpose: 'PASSWORD_RESET' });
  await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Email OTP' }).fill('000000');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect OTP.');
  await page.getByRole('textbox', { name: 'Email OTP' }).fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('✓ Email verified')).toBeVisible();
  await page.getByRole('button', { name: 'Continue To Reset Password' }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  expect(proofHeader).toBe('test-proof');
  expect(page.url()).not.toContain('reset-capability');
});

test('editing email clears OTP input and verified appearance', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/email/send')) return route.fulfill({ json: { challengeId: 'one', resendAfter: 60 } });
    if (path.endsWith('/auth/email/verify')) return route.fulfill({ json: { proof: 'proof-one', expiresIn: 1800 } });
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/forgot-password');
  await page.getByPlaceholder('Your account email').fill('first@example.com');
  await page.getByRole('button', { name: 'Send OTP', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email OTP' }).fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('✓ Email verified')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify again', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Email OTP' })).toHaveCount(0);
  await page.getByPlaceholder('Your account email').fill('second@example.com');
  await expect(page.getByText('✓ Email verified')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Email OTP' })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Verify', exact: true })).toBeDisabled();
});
