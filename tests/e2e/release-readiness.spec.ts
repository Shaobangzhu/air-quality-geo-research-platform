import { expect, test } from '@playwright/test';

for (const flow of [
  {
    path: '/map?mode=sample',
    api: '**/api/station-readings?*',
    loading: 'Loading station readings…',
    error: 'Sample observations unavailable.',
    ready: 'Inspect SYNTHETIC SAMPLE',
  },
  {
    path: '/analysis?mode=sample',
    api: '**/api/analysis-series?*',
    loading: 'Loading observation series…',
    error: 'Sample series unavailable.',
    ready: 'Inspect observation time',
  },
  {
    path: '/wildfire?mode=historical',
    api: '**/api/wildfire/**',
    loading: 'Loading verified local case…',
    error: 'BLOCKED — verified case unavailable',
    ready: 'Context selection',
  },
  {
    path: '/data',
    api: '**/api/data/catalog',
    loading: 'Loading local source catalog…',
    error: 'Source catalog unavailable.',
    ready: 'View source',
  },
]) {
  test(`reports loading and service failure, then recovers on ${flow.path}`, async ({
    page,
  }) => {
    let release!: () => void;
    const response = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(flow.api, async (route) => {
      await response;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":{"code":"DATABASE_UNAVAILABLE"}}',
      });
    });
    await page.goto(flow.path);
    try {
      await expect(page.getByText(flow.loading, { exact: true })).toBeVisible();
    } finally {
      release();
    }
    await expect(page.getByText(flow.error, { exact: false })).toBeVisible();
    await page.unroute(flow.api);
    await page.reload();
    if (
      flow.ready.startsWith('Inspect SYNTHETIC') ||
      flow.ready === 'View source'
    )
      await expect(
        page.getByRole('button', { name: new RegExp(flow.ready) }).first(),
      ).toBeVisible();
    else await expect(page.getByLabel(flow.ready)).toBeVisible();
  });
}

test('keeps empty sample results distinct from service failure across Map, Analysis and export', async ({
  page,
}) => {
  // This real fixture has no monitor in the Inland Empire engineering preset.
  await page.goto('/map?region=inland-empire&pollutant=PM10&mode=sample');
  await expect(page.getByText(/No PM10 stations reported/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Analysis' })
    .click();
  await expect(page.getByText(/No PM10 observations reported/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.goto(
    '/data?tab=preview&mode=sample&pollutant=PM10&region=inland-empire',
  );
  await page.getByRole('button', { name: 'Load preview' }).click();
  await expect(page.getByText(/No records match this selection/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^aq-sample-stations-.*\.json$/,
  );
});
