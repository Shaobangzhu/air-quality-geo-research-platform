import { expect, test } from '@playwright/test';
import {
  observationsResponseSchema,
  stationsResponseSchema,
  usageSummarySchema,
} from '@aq/contracts';

test('starts both local services, navigates planned pages and makes no provider requests', async ({
  page,
  request,
}) => {
  const externalRequests: string[] = [];
  page.on('request', (req) => {
    if (!new URL(req.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      externalRequests.push(req.url());
  });
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({
    database: 'not-configured',
    data: { mode: 'sample', state: 'available' },
  });
  const stations = stationsResponseSchema.parse(
    await (await request.get('/api/stations?mode=sample')).json(),
  );
  expect(stations.data.length).toBeGreaterThan(0);
  expect(
    stations.data.every((station) =>
      station.identity.nativeSiteId.startsWith('SAMPLE-'),
    ),
  ).toBe(true);
  const series = observationsResponseSchema.parse(
    await (
      await request.get(
        `/api/stations/${stations.data[0]!.id}/observations?mode=sample`,
      )
    ).json(),
  );
  expect(series.meta.dataMode).toBe('sample');
  expect(series.meta.cache.status).toBe('hit');
  const usage = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  expect(usage.providers.every((provider) => provider.requests === 0)).toBe(
    true,
  );
  await page.goto('/map');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Greater LA Air Quality',
  );
  await expect(page.getByText('Configured mode: sample')).toBeVisible();
  for (const [path, name] of [
    ['/analysis', 'Analysis'],
    ['/wildfire', 'Wildfire Case Study'],
    ['/data', 'Data & Methodology'],
    ['/map', 'Map Explorer'],
  ]) {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: new RegExp(name!) })
      .click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(
      page.getByRole('heading', { level: 2, name: name! }),
    ).toBeVisible();
    await expect(page.getByText('Configured mode: sample')).toBeVisible();
  }
  expect(externalRequests).toEqual([]);
});

test('mobile shell has no horizontal overflow and exposes navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/map');
  await expect(page.getByText('Configured mode: sample')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole('navigation')).toBeVisible();
});
