import { test, expect } from '@playwright/test';

for (const failedStatus of [403, 500, null]) {
  test(`student profile and successful summaries survive optional module HTTP ${failedStatus}`, async ({ page }) => {
    const permissions = ['attendance', 'fees', 'notices', 'timetable', 'examinations', ...(failedStatus ? ['transport', 'library'] : [])].map(feature => ({ feature, enabled: true }));
    const requests = [];
    await page.addInitScript(() => localStorage.setItem('erp.auth.session', JSON.stringify({ role: 'student', studentId: 7, instituteName: 'Test School' })));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith('/api/')) return route.continue();
      requests.push(path);
      if (path === '/api/auth/refresh') return route.fulfill({ json: { role: 'STUDENT', studentId: 7, instituteId: 1, instituteName: 'Test School', permissions, accessToken: 'test-token' } });
      if (path === '/api/auth/me') return route.fulfill({ json: { role: 'STUDENT', studentId: 7, instituteId: 1, instituteName: 'Test School', permissions } });
      if (path === '/api/students/me/dashboard') return route.fulfill({ json: { id: 7, firstName: 'Asha', lastName: 'Sharma', assignedClass: 'Class 8', enrollmentNo: 'ST007' } });
      if (path.startsWith('/api/transport/') || path.startsWith('/api/library/')) return route.fulfill({ status: failedStatus, json: { message: 'Module unavailable' } });
      if (path.startsWith('/api/attendance/')) return route.fulfill({ json: [{ status: 'Present' }] });
      if (path.startsWith('/api/fees/')) return route.fulfill({ json: { totalPaid: 1200 } });
      if (path.startsWith('/api/examinations/')) return route.fulfill({ json: { dateSheets: [], admitCards: [] } });
      if (path.startsWith('/api/notices/')) return route.fulfill({ json: { content: [{ title: 'School assembly tomorrow' }] } });
      if (path.startsWith('/api/timetables/')) return route.fulfill({ status: 204 });
      return route.fulfill({ json: {} });
    });
    await page.goto('/student');
    await expect(page.getByText(/Welcome Asha Sharma/)).toBeVisible();
    await expect(page.getByText('Test School | Class 8 | ST007')).toBeVisible();
    await expect(page.getByText('100%', { exact: true })).toBeVisible();
    await expect(page.getByText('School assembly tomorrow')).toBeVisible();
    await expect(page.getByText('Unable to load student dashboard data.')).toHaveCount(0);
    if (!failedStatus) {
      await expect(page.getByRole('button', { name: /^Transport/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Library/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Hostel/ })).toHaveCount(0);
      await expect(page.getByText('Library Loans', { exact: true })).toHaveCount(0);
      expect(requests.some(path => /\/(transport|library|hostel)\//.test(path))).toBe(false);
      return;
    }
    await expect(page.getByText('Unavailable', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Transport Summary unavailable/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Library Summary unavailable/ })).toBeVisible();
  });
}
