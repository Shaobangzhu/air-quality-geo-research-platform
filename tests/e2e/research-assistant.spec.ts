import { test, expect } from '@playwright/test';
test('optional assistant remains disabled without keys and does not replace the chart', async ({
  page,
}) => {
  let answers = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/research/answer')) answers++;
  });
  await page.goto('/analysis?mode=sample');
  await page.getByLabel('Inspect observation time').waitFor();
  await page
    .getByText('Research Assistant · optional · open to check configuration')
    .click();
  await expect(
    page.getByText('Research Assistant · optional · disabled', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ask Research Assistant' }),
  ).toBeDisabled();
  await expect(page.getByLabel('Inspect observation time')).toBeVisible();
  expect(answers).toBe(0);
});
