import { test, expect } from '@playwright/test';

for (const role of ['STUDENT', 'TEACHER']) {
  test(`${role} first login changes password only after email OTP`, async ({ page }) => {
    let changes = 0;
    let sends = 0;
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const session = { instituteId: 1, accountId: 8, role, username: 'FIRST01', mustChangePassword: true,
      studentId: role === 'STUDENT' ? 2 : null, teacherId: role === 'TEACHER' ? 2 : null, permissions: [], accessToken: `test.${payload}.test` };
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/refresh') || path.endsWith('/auth/me')) return route.fulfill({ json: session });
      if (path.endsWith('/auth/password/change/otp')) {
        sends++;
        expect(route.request().postDataJSON()).toEqual({ currentPassword: 'Old@1234', newPassword: 'New@1234', confirmPassword: 'New@1234' });
        return route.fulfill({ json: { challengeId: 'challenge', maskedEmail: 's***@example.com', resendAfter: 60 } });
      }
      if (path.endsWith('/auth/email/verify')) {
        if (route.request().postDataJSON().otp !== '123456') return route.fulfill({ status: 400, json: { message: 'Incorrect OTP.' } });
        return route.fulfill({ json: { proof: 'first-login-proof', expiresIn: 1800 } });
      }
      if (path.endsWith('/auth/password/change')) {
        expect(route.request().headers()['x-email-verification']).toBe('first-login-proof');
        changes++;
        return route.fulfill({ status: 204 });
      }
      if (path.endsWith('/auth/logout')) return route.fulfill({ status: 204 });
      return route.fulfill({ status: 401, json: {} });
    });
    await page.goto('/change-password');
    await page.getByLabel('Current Password', { exact: true }).fill('Old@1234');
    await page.getByLabel('New Password', { exact: true }).fill('New@1234');
    await page.getByLabel('Confirm Password', { exact: true }).fill('New@1234');
    await page.getByRole('button', { name: 'Update Password', exact: true }).click();
    await expect(page.getByText(/Your password has not changed yet/)).toBeVisible();
    expect(sends).toBe(1);
    expect(changes).toBe(0);
    await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
    await expect(page.getByLabel('New Password', { exact: true })).toBeDisabled();
    await page.getByLabel('Email OTP').fill('000000');
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await expect(page.getByText('Incorrect OTP.', { exact: true })).toBeVisible();
    expect(changes).toBe(0);
    await page.getByLabel('Email OTP').fill('123456');
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(changes).toBe(1);
  });
}
