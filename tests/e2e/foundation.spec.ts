import { readFile } from 'node:fs/promises';
import { jsonExportSchema } from '@aq/contracts';
import { expect, test } from '@playwright/test';
import {
  observationsResponseSchema,
  stationsResponseSchema,
  usageSummarySchema,
} from '@aq/contracts';

test('starts both local services, browses sample identities and preserves context across exactly four pages', async ({
  page,
  request,
}) => {
  const externalRequests: string[] = [];
  page.on('request', (req) => {
    if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(req.url()).hostname))
      externalRequests.push(req.url());
  });
  const health = await request.get('/api/health');
  expect(await health.json()).toMatchObject({
    database: 'not-configured',
    data: { mode: 'sample', state: 'available' },
  });
  const stations = stationsResponseSchema.parse(
    await (await request.get('/api/stations?mode=sample')).json(),
  );
  expect(stations.data).toHaveLength(3);
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
  await page.goto('/map?mode=sample&pollutant=O3');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Map Explorer' }),
  ).toBeVisible();
  await expect(page.getByLabel('Data status')).toHaveText('Sample · Synthetic');
  await expect(page.getByLabel('Map filters')).toBeVisible();
  await expect(page.getByLabel('Pollutant')).toHaveValue('O3');
  await expect(
    page.getByRole('heading', { name: 'Basemap unavailable' }),
  ).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await page
    .getByRole('button', { name: /^Inspect/ })
    .first()
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Station Details' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Close station details' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /^Inspect/ }).first(),
  ).toBeFocused();
  for (const [path, name] of [
    ['/analysis', 'Analysis'],
    ['/data', 'Data & Methodology'],
    ['/map', 'Map Explorer'],
  ]) {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: name! })
      .click();
    await expect(page).toHaveURL(new RegExp(`${path}\\?.*pollutant=O3`));
    await expect(
      page.getByRole('heading', { level: 1, name: name! }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation').getByRole('link', { name: name! }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Data status')).toHaveText(
      path === '/data' ? 'Data transparency' : 'Sample · Synthetic',
    );
  }
  const usage = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  expect(usage.providers.every((provider) => provider.requests === 0)).toBe(
    true,
  );
  expect(externalRequests).toEqual([]);
});

test('supports keyboard navigation, safe deep links, Back and explicit unavailable modes', async ({
  page,
}) => {
  await page.goto('/map?mode=invalid&region=world&pollutant=invalid');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to workspace' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByLabel('Pollutant')).toHaveValue('PM2.5');
  await expect(page.getByLabel('Data status')).toHaveText('Sample · Synthetic');
  await page.getByLabel('Pollutant').selectOption('PM10');
  await expect(page).toHaveURL(/pollutant=PM10/);
  await page.goBack();
  await expect(page.getByLabel('Pollutant')).toHaveValue('PM2.5');
  await page.getByRole('button', { name: 'Layers & Legend' }).click();
  await expect(
    page.getByRole('button', { name: 'Layers & Legend' }),
  ).toHaveAttribute('aria-expanded', 'false');
  await page.getByLabel('Data mode').selectOption('live');
  await expect(page.getByRole('alert')).toContainText(
    'Live observations unavailable',
  );
  await expect(page.getByLabel('Data status')).toHaveText('Unavailable');
  await page.getByLabel('Data mode').selectOption('historical');
  await expect(page.getByRole('alert')).toContainText(
    'official curated snapshot',
  );
});

for (const width of [1440, 1280, 390]) {
  test(`map shell and selected drawer remain usable without overflow at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/map?mode=sample');
    await expect(page.getByLabel('Data status')).toHaveText(
      'Sample · Synthetic',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`map-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: /^Inspect/ })
      .first()
      .click();
    await expect(page.getByRole('complementary')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const catalog = page.getByLabel('Map Explorer workspace');
    expect(
      await catalog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`map-drawer-${width}.png`),
      fullPage: true,
    });
  });
}

test('selects clearly synthetic readings and opens Analyze with validated context and no passive refetch', async ({
  page,
  request,
}) => {
  const calls: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/station-readings')
      calls.push(new URL(req.url()).search);
  });
  await page.goto('/map?mode=sample&pollutant=PM2.5');
  await expect(page.getByLabel('Data status')).toHaveText('Sample · Synthetic');
  await expect(page.getByLabel('Concentration legend')).toContainText(
    'Display bins only',
  );
  const initial = calls.length;
  await page
    .getByRole('button', { name: /^Inspect/ })
    .first()
    .click();
  const drawer = page.getByRole('complementary', { name: 'Station Details' });
  await expect(drawer).toContainText('Synthetic sample');
  await expect(
    drawer.getByRole('region', { name: 'AQI observation', exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole('region', {
      name: 'Concentration observation',
      exact: true,
    }),
  ).toContainText('µg/m³');
  await expect(drawer).toContainText('unknown');
  await expect(drawer).toContainText('2026-01-15T20:00:00Z');
  await expect(drawer).toContainText('PST');
  await page.getByRole('button', { name: 'Layers & Legend' }).click();
  expect(calls).toHaveLength(initial);
  const link = drawer.getByRole('link', { name: 'Analyze This Station' });
  const target = new URL(
    (await link.getAttribute('href'))!,
    'http://localhost',
  );
  expect(target.searchParams.get('stationId')).toMatch(/^s_[a-f0-9]{32}$/);
  expect(target.searchParams.get('pollutant')).toBe('PM2.5');
  expect(target.searchParams.get('mode')).toBe('sample');
  await link.click();
  await expect(page).toHaveURL(/\/analysis\?.*stationId=s_/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Analysis' }),
  ).toBeVisible();
  await expect(page.getByText(/Selected monitor:/)).toContainText(
    'SYNTHETIC SAMPLE',
  );
  expect(calls).toHaveLength(initial);
  const usage = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  expect(usage.providers.every((provider) => provider.requests === 0)).toBe(
    true,
  );
});

test('filters engineering presets, preserves or clears selection, and reloads the Analysis handoff', async ({
  page,
  request,
}) => {
  const calls: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/station-readings')
      calls.push(req.url());
  });
  const before = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  await page.goto('/map?mode=sample&pollutant=PM2.5');
  await expect(page.getByLabel('Data status')).toHaveText('Sample · Synthetic');
  await page
    .getByRole('button', { name: /^Inspect SYNTHETIC SAMPLE Alpha,/ })
    .first()
    .click();
  const stationId = new URL(page.url()).searchParams.get('stationId');
  const initial = calls.length;
  await page.getByLabel('Region', { exact: true }).selectOption('coastal-la');
  await expect(page.getByRole('button', { name: /^Inspect/ })).toHaveCount(2);
  await expect(page.getByRole('complementary')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('stationId')).toBe(stationId);
  expect(calls.length).toBe(initial + 1);
  await page.reload();
  await expect(page.getByRole('complementary')).toBeVisible();
  const afterReload = calls.length;
  await expect(page.getByLabel('Region', { exact: true })).toHaveValue(
    'coastal-la',
  );
  await page.getByLabel('Pollutant', { exact: true }).selectOption('O3');
  await expect(page.getByText(/Selection cleared\./)).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('stationId')).toBe(false);
  await expect(page.getByLabel('Concentration legend')).toContainText('ppb');
  await page.goBack();
  await expect(page.getByRole('complementary')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('stationId')).toBe(stationId);
  await page.goForward();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(page.getByLabel('Pollutant', { exact: true })).toHaveValue('O3');
  await page
    .getByLabel('Region', { exact: true })
    .selectOption('inland-empire');
  await page.getByLabel('Pollutant', { exact: true }).selectOption('PM10');
  await expect(
    page.getByText('No PM10 stations reported in this region and time window.'),
  ).toBeVisible();
  await page.getByLabel('Region', { exact: true }).selectOption('coastal-la');
  await expect(page.getByRole('button', { name: /^Inspect/ })).toHaveCount(2);
  await page
    .getByRole('button', { name: /^Inspect/ })
    .first()
    .click();
  const passive = calls.length;
  await page.getByRole('button', { name: 'Layers & Legend' }).click();
  const link = page.getByRole('link', { name: 'Analyze This Station' });
  const target = new URL((await link.getAttribute('href'))!, page.url());
  expect(Object.fromEntries(target.searchParams)).toMatchObject({
    region: 'coastal-la',
    pollutant: 'PM10',
    mode: 'sample',
    product: 'monitoring-stations',
  });
  expect(target.searchParams.get('stationId')).toMatch(/^s_/);
  await link.click();
  await expect(page).toHaveURL(target.toString());
  expect(calls.length).toBe(passive);
  expect(calls.length).toBe(afterReload + 6); // one read per changed filter; development reload may cancel an initial read
  await page.reload();
  await expect(page.getByText(/Selected monitor:/)).toContainText('PM10');
  const after = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  expect(after.providers.map((p) => p.requests)).toEqual(
    before.providers.map((p) => p.requests),
  );
  expect(after.cache.hits).toBeGreaterThan(before.cache.hits);
});

test('Map → Analysis → 72-hour gap chart → Data preserves scientific context offline', async ({
  page,
  request,
}, testInfo) => {
  const calls: string[] = [];
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname === '/api/analysis-series') calls.push(url.search);
    if (!/^(127\.0\.0\.1|localhost)$/.test(url.hostname))
      external.push(url.hostname);
  });
  await page.goto('/map?mode=sample&measurementType=concentration');
  await page
    .getByRole('button', {
      name: /^Inspect SYNTHETIC SAMPLE Alpha co-located,/,
    })
    .click();
  const primary = new URL(page.url()).searchParams.get('stationId');
  await page.getByRole('link', { name: 'Analyze This Station' }).click();
  await expect(page.getByLabel('Primary monitoring station')).toHaveValue(
    primary!,
  );
  await expect(page.getByLabel('Inspect observation time')).toBeVisible();
  await page.getByLabel('Observation window').selectOption('72');
  await expect(
    page.getByLabel('Inspect observation time').locator('option'),
  ).toHaveCount(72);
  await expect(page).toHaveURL(/windowHours=72/);
  await expect(
    page.getByLabel('Observation window').locator('option'),
  ).toHaveCount(3);
  await expect(
    page.getByRole('region', { name: 'Analysis summary' }),
  ).toContainText('48');
  const curve = page.locator('.recharts-line-curve').first();
  await expect(curve).toBeVisible();
  const path = (await curve.getAttribute('d'))!;
  expect((path.match(/M/g) ?? []).length).toBe(2); // a null interior hour produces two disconnected SVG segments
  const before = calls.length;
  await page.locator('.recharts-line-dots .recharts-dot').first().hover();
  await expect(page.getByRole('tooltip')).toContainText('unknown');
  await expect(page.getByRole('tooltip')).toContainText('µg/m³');
  await page.locator('.recharts-line-dots .recharts-dot').first().click();
  await expect(
    page.getByRole('region', { name: 'Observation inspection' }),
  ).toContainText('2026-01-15T17:00:00Z');
  await page.getByLabel('Inspect observation time').focus();
  await page.getByLabel('Inspect observation time').selectOption('69'); // 18:00Z, explicit null
  // A late hover event must not override explicit inspector focus/selection.
  await page.locator('.recharts-line-dots .recharts-dot').first().hover();
  await expect(
    page.getByRole('region', { name: 'Observation inspection' }),
  ).toContainText('Missing value');
  await page.getByRole('button', { name: 'Previous hour' }).click();
  expect(calls.length).toBe(before);
  const boxes = page.getByRole('checkbox');
  for (let i = 0; i < 2; i++) {
    const available = boxes.filter({ visible: true });
    for (let j = 0; j < (await available.count()); j++) {
      const box = available.nth(j);
      if ((await box.isEnabled()) && !(await box.isChecked())) {
        await box.check();
        break;
      }
    }
    await expect(page.locator('.series-legend li')).toHaveCount(i + 2);
  }
  await expect(page.getByLabel('Series legend')).toContainText('Dashed line');
  await expect(page.getByLabel('Series legend')).toContainText('Dotted line');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath('analysis-three-stations-1440.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('analysis-three-stations-390.png'),
    fullPage: true,
  });
  const link = page.getByRole('link', { name: 'View Data & Methodology' });
  const target = new URL((await link.getAttribute('href'))!, page.url());
  expect(target.searchParams.get('stationId')).toBe(primary);
  expect(target.searchParams.get('windowHours')).toBe('72');
  expect(target.searchParams.get('compare')!.split(',')).toHaveLength(2);
  await link.click();
  await expect(page).toHaveURL(target.toString());
  const usage = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  expect(usage.providers.every((provider) => provider.requests === 0)).toBe(
    true,
  );
  expect(external).toEqual([]);
});

test('keeps area aggregates and predictions separate from station layers, URLs and Analysis', async ({
  page,
  request,
}, testInfo) => {
  const requests: string[] = [];
  page.on('request', (req) => {
    const path = new URL(req.url()).pathname;
    if (path.startsWith('/api/')) requests.push(path);
  });
  await page.goto('/map?mode=sample');
  await expect(
    page.getByRole('button', { name: /^Inspect SYNTHETIC SAMPLE/ }),
  ).toHaveCount(3);
  await page.getByLabel('Map canvas').evaluate((element) => {
    (window as unknown as { areaCanvas: Element }).areaCanvas = element;
  });
  await page.getByLabel('Data Product').selectOption('reporting-area-aqi');
  await expect(
    page.getByRole('button', { name: /^Inspect reporting area/ }),
  ).toHaveCount(2);
  await expect(page.getByLabel('Reporting Area AQI legend')).toContainText(
    'aggregate observations',
  );
  await expect(page.getByLabel('Monitoring station readings')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Analyze This Station' }),
  ).toHaveCount(0);
  const count = requests.length;
  const button = page
    .getByRole('button', { name: /^Inspect reporting area/ })
    .first();
  await button.click();
  await expect(
    page.getByRole('button', { name: 'Close reporting area details' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(button).toBeFocused();
  expect(requests.length).toBe(count);
  await page.getByLabel('Data Product').selectOption('forecast');
  await page
    .getByRole('button', { name: /^Inspect reporting area/ })
    .first()
    .click();
  const drawer = page.getByRole('complementary', {
    name: 'Reporting Area Details',
  });
  await expect(drawer).toContainText('AQI number not supplied · category only');
  await expect(drawer).toContainText('2026-01-16 · date only');
  await expect(drawer).toContainText('issuance time unknown');
  await expect(drawer).toContainText('Prediction · not an observation');
  expect(new URL(page.url()).searchParams.has('stationId')).toBe(false);
  expect(
    await page
      .getByLabel('Map canvas')
      .evaluate(
        (element) =>
          (window as unknown as { areaCanvas: Element }).areaCanvas === element,
      ),
  ).toBe(true);
  const url = page.url();
  await page.reload();
  await expect(
    page.getByRole('complementary', { name: 'Reporting Area Details' }),
  ).toBeVisible();
  await expect(page).toHaveURL(url);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`area-forecast-${width}.png`),
      fullPage: true,
    });
  }
  await drawer.getByRole('link', { name: 'View Data & Methodology' }).click();
  await expect(page).toHaveURL(/\/data\?.*product=forecast/);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Analysis' })
    .click();
  await expect(page.getByLabel('Inspect observation time')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('product')).toBe(
    'monitoring-stations',
  );
  expect(new URL(page.url()).searchParams.has('areaId')).toBe(false);
  const usage = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  expect(usage.providers.every((provider) => provider.requests === 0)).toBe(
    true,
  );
});

test('rejects unavailable live and historical area products without an implicit sample fallback', async ({
  page,
}) => {
  await page.goto('/map?product=forecast&mode=live');
  await expect(page.getByRole('alert')).toContainText(
    'contract is not verified',
  );
  await expect(page.getByRole('button', { name: /^Inspect/ })).toHaveCount(0);
  await expect(
    page.getByRole('option', { name: 'Forecast · unavailable' }),
  ).toHaveAttribute('disabled', '');
  await page.getByLabel('Data mode').selectOption('historical');
  await expect(page.getByRole('alert')).toContainText(
    'no verified reporting-area archive',
  );
  await expect(page.getByLabel('Data status')).toContainText('Unavailable');
});

test('explores the official Eaton case offline with static layers, honest checkpoints and source handoff', async ({
  page,
  request,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!['localhost', '127.0.0.1'].includes(new URL(r.url()).hostname))
      external.push(new URL(r.url()).hostname);
  });
  const result = await request.get(
    '/api/wildfire/eaton-fire-2025?mode=historical',
  );
  expect(result.status()).toBe(200);
  const c = await result.json();
  expect(c.batch.observations).toHaveLength(71);
  await page.goto('/wildfire');
  await expect(page.getByLabel('Data status')).toHaveText('Historical');
  await expect(
    page.getByRole('heading', { name: '2025 Eaton Fire', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Basemap unavailable' }),
  ).toBeVisible();
  const map = page.getByLabel('Map canvas');
  await map.evaluate((el) => el.setAttribute('data-case-instance', 'stable'));
  await page.getByLabel('LRA · 2025 recommendations').uncheck();
  await expect(
    page
      .getByLabel('Context selection')
      .locator('option')
      .filter({ hasText: 'LRA ·' }),
  ).toHaveCount(0);
  await page.getByLabel('LRA · 2025 recommendations').check();
  await page
    .getByLabel('Context selection')
    .selectOption(
      c.layers.find((f: { layer: string }) => f.layer === 'lra').id,
    );
  await expect(
    page.getByText('Published after ignition; not an as-of-Jan-7 layer.'),
  ).toBeVisible();
  await page.getByRole('button', { name: /Later checkpoint/ }).click();
  await page.getByLabel('Observation hour (PST)').selectOption('05');
  await expect(
    page.getByText('Missing observation', { exact: true }),
  ).toBeVisible();
  await expect(map).toHaveAttribute('data-case-instance', 'stable');
  await expect(
    page.getByRole('button', { name: '3D unavailable' }),
  ).toBeDisabled();
  await expect(
    page.getByLabel('Official AirNow contours — unverified'),
  ).toBeDisabled();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole('link', { name: 'View Data & Methodology' }).click();
  await expect(page).toHaveURL(/\/data\?.*case=eaton-fire-2025/);
  await expect(
    page.getByRole('heading', { name: 'Integrated data sources' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Data Preview & Export' }).click();
  await page.getByRole('button', { name: 'Load preview' }).click();
  await expect(page.getByText(/71 selected records · fetched/)).toBeVisible();
  expect(external).toEqual([]);
});
test('isolates unsupported wildfire modes and reports missing assets without a fallback', async ({
  page,
}) => {
  await page.goto('/wildfire?mode=live');
  await expect(
    page.getByText('Historical case only', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Context selection')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Open historical Eaton case' })
    .click();
  await expect(page.getByLabel('Context selection')).toBeVisible();
  await page.route('**/api/wildfire/**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ state: 'blocked' }),
    }),
  );
  await page.reload();
  await expect(
    page.getByText('BLOCKED — verified case unavailable'),
  ).toBeVisible();
  await expect(page.getByLabel('Context selection')).toHaveCount(0);
});

test('uses four Data tabs, previews and downloads a pinned subset with embedded provenance', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(r.url()).hostname))
      external.push(new URL(r.url()).hostname);
  });
  await page.goto('/data?mode=sample');
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await page
    .getByRole('button', { name: /View source Eaton study · EPA/ })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Source details' }),
  ).toContainText('row certification unknown');
  await page.getByRole('tab', { name: 'Data Preview & Export' }).click();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load preview' }).click();
  await expect(page.getByRole('button', { name: 'Export JSON' })).toBeVisible();
  const preview = await (
    await page.request.get(
      '/api/data/preview?dataset=sample-stations&region=greater-la&pollutant=PM2.5&measurementType=concentration',
    )
  ).json();
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const jsonFile = await jsonDownload;
  expect(jsonFile.suggestedFilename()).toMatch(
    /^aq-sample-stations-[a-f0-9]{12}\.json$/,
  );
  const exported = jsonExportSchema.parse(
    JSON.parse(await readFile((await jsonFile.path())!, 'utf8')),
  );
  expect(exported.manifest.selectionHash).toBe(preview.manifest.selectionHash);
  expect(exported.data.slice(0, 10)).toEqual(preview.data);
  expect(exported.manifest.dataMode).toBe('sample');
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csvFile = await csvDownload;
  const csv = await readFile((await csvFile.path())!, 'utf8');
  expect(csv).toContain('"manifest"');
  expect(csv).toContain(exported.manifest.selectionHash);
  expect(csv).toContain('"\\N"');
  for (const width of [1440, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole('tab', { name: 'Scientific Methodology' }).click();
  await page
    .getByText('Fire Hazard Severity Zones (FHSZ)', { exact: true })
    .click();
  await expect(page.getByText(/Unmapped is not Low/)).toBeVisible();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  expect(external).toEqual([]);
});
test('shows measured since-start cache outcomes after known local BFF reads and excludes ArcGIS billing', async ({
  page,
  request,
}) => {
  const before = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  const key =
    '/api/station-readings?mode=sample&pollutant=PM10&measurementType=concentration&windowHours=19&endAt=2026-01-15T20:00:00Z';
  expect((await request.get(key)).ok()).toBe(true);
  expect((await request.get(key)).ok()).toBe(true);
  const after = usageSummarySchema.parse(
    await (await request.get('/api/usage/summary')).json(),
  );
  expect(after.cache.misses).toBe(before.cache.misses + 1);
  expect(after.cache.hits).toBe(before.cache.hits + 1);
  expect(
    after.providers.every((p) => p.requests === 0 && p.failures === 0),
  ).toBe(true);
  const usageResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/usage/summary',
  );
  await page.goto('/data?tab=usage');
  const response = await usageResponse;
  const current = response
    ? usageSummarySchema.parse(await response.json())
    : usageSummarySchema.parse(
        await (await request.get('/api/usage/summary')).json(),
      );
  await expect(
    page.getByText('Outbound attempts', { exact: true }).locator('..'),
  ).toContainText(
    String(current.providers.reduce((a, p) => a + p.requests, 0)),
  );
  await expect(page.getByText('ArcGIS (client)')).toBeVisible();
  await expect(page.getByText(/Not tracked locally/)).toBeVisible();
  await expect(page.getByText(/Counters reset whenever/)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh usage' }).click();
  await expect(
    page.getByText('Failed outbound', { exact: true }).locator('..'),
  ).toContainText('0');
});
