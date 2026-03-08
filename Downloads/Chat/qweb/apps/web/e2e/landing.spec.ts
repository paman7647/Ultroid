import { test, expect } from '@playwright/test';

test('landing page renders CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /modern real-time chat/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /create account/i })).toBeVisible();
});
