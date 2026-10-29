// Capture the actual running local app; never substitutes mocked API responses.
// Start `npm run dev` first. Uses the configured public ArcGIS token if present.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = 'http://127.0.0.1:5173';
const output = new URL('../docs/release/screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  pages: [],
  pageErrors: 0,
  externalHosts: new Set(),
  apiRequests: {},
  capturedAt: new Date().toISOString(),
};
page.on('pageerror', () => {
  report.pageErrors++;
});
page.on('request', (req) => {
  const url = new URL(req.url());
  if (
    ['http:', 'https:'].includes(url.protocol) &&
    !['localhost', '127.0.0.1'].includes(url.hostname)
  )
    report.externalHosts.add(url.hostname);
  if (url.pathname.startsWith('/api/'))
    report.apiRequests[url.pathname] =
      (report.apiRequests[url.pathname] ?? 0) + 1;
});
async function capture(name) {
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: new URL(`${name}-${width}.png`, output).pathname,
      fullPage: true,
    });
    report.pages.push({ name, width, documentOverflow: false });
  }
}
async function mapSettled() {
  await expect
    .poll(
      async () =>
        await page
          .getByRole('heading', { name: 'Loading geographic context…' })
          .count(),
      { timeout: 25000 },
    )
    .toBe(0);
  const element = page.locator('arcgis-map');
  if (await element.count()) {
    await expect
      .poll(
        () => element.evaluate((el) => Boolean(el.ready) && !el.view.updating),
        { timeout: 30000 },
      )
      .toBe(true);
  }
  return (await page
    .getByRole('heading', { name: 'Basemap unavailable' })
    .count())
    ? 'unavailable'
    : 'online';
}
try {
  const health = await (await page.request.get(`${baseURL}/api/health`)).json();
  if (health.database !== 'connected')
    throw new Error(
      'Confirmed project database must be connected for this capture.',
    );
  report.database = health.database;
  await page.goto(`${baseURL}/map?mode=sample&measurementType=concentration`);
  await page
    .getByRole('button', {
      name: /^Inspect SYNTHETIC SAMPLE Alpha co-located,/,
    })
    .click();
  report.mapBasemap = await mapSettled();
  const initialMap = await page.locator('arcgis-map').count();
  if (initialMap)
    await page.locator('arcgis-map').evaluate((el) => {
      el.dataset.releaseInstance = 'persistent';
    });
  await page.getByLabel('Pollutant', { exact: true }).selectOption('O3');
  await page.getByLabel('Pollutant', { exact: true }).selectOption('PM2.5');
  await page
    .getByRole('button', {
      name: /^Inspect SYNTHETIC SAMPLE Alpha co-located,/,
    })
    .click();
  if (initialMap)
    await expect(page.locator('arcgis-map')).toHaveAttribute(
      'data-release-instance',
      'persistent',
    );
  report.mapPersistentAcrossFilters = Boolean(initialMap);
  await capture('map');
  await page.getByRole('link', { name: 'Analyze This Station' }).click();
  await page.getByLabel('Inspect observation time').waitFor();
  await page.getByLabel('Observation window').selectOption('72');
  await expect(
    page.getByLabel('Inspect observation time').locator('option'),
  ).toHaveCount(72);
  for (let i = 0; i < 2; i++) {
    const boxes = page.getByRole('checkbox');
    for (let j = 0; j < (await boxes.count()); j++) {
      const box = boxes.nth(j);
      if ((await box.isEnabled()) && !(await box.isChecked())) {
        await box.check();
        break;
      }
    }
    await expect(page.locator('.series-legend li')).toHaveCount(i + 2);
  }
  await expect(page.locator('.recharts-line-curve').first()).toBeVisible();
  report.analysisNullGaps =
    (
      (
        await page.locator('.recharts-line-curve').first().getAttribute('d')
      ).match(/M/g) ?? []
    ).length > 1;
  await capture('analysis');
  await expect(page.locator('arcgis-map')).toHaveCount(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Wildfire Case Study' })
    .click();
  await page.getByLabel('Context selection').waitFor();
  report.wildfireBasemap = await mapSettled();
  await expect(page.locator('arcgis-map')).toHaveCount(
    report.wildfireBasemap === 'online' ? 1 : 0,
  );
  await page.getByRole('button', { name: /Ignition day/ }).click();
  await capture('wildfire');
  await page.getByRole('button', { name: /Later checkpoint/ }).click();
  await page.getByLabel('Observation hour (PST)').selectOption('05');
  await expect(
    page.getByText('Missing observation', { exact: true }),
  ).toBeVisible();
  report.eatonAbsentHour = true;
  await page.getByRole('link', { name: 'View Data & Methodology' }).click();
  await page
    .getByRole('button', { name: /View source Eaton study · EPA/ })
    .click();
  await capture('data');
  await page.getByRole('tab', { name: 'Data Preview & Export' }).click();
  await page.getByRole('button', { name: 'Load preview' }).click();
  await expect(page.getByText(/71 selected records · fetched/)).toBeVisible();
  await capture('export');
  for (const format of ['JSON', 'CSV']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: `Export ${format}` }).click();
    const file = await download;
    await mkdir(new URL('../.local/milestone10/', import.meta.url), {
      recursive: true,
    });
    await file.saveAs(
      new URL(
        `../.local/milestone10/eaton-export.${format.toLowerCase()}`,
        import.meta.url,
      ).pathname,
    );
  }
  await page.getByRole('tab', { name: 'API Usage' }).click();
  await page.getByText('Outbound attempts', { exact: true }).waitFor();
  await capture('usage');
  const before = { ...report.apiRequests };
  // One bounded idle observation; a steady page should not poll.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  report.idleApiReads = Object.keys(report.apiRequests).reduce(
    (n, k) => n + report.apiRequests[k] - (before[k] ?? 0),
    0,
  );
  const usage = await (
    await page.request.get(`${baseURL}/api/usage/summary`)
  ).json();
  report.outboundProviderAttempts = usage.providers.reduce(
    (sum, p) => sum + p.requests,
    0,
  );
  report.cache = usage.cache;
  report.externalHosts = [...report.externalHosts].sort();
  await writeFile(
    new URL('../.local/milestone10/browser-verification.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  if (
    report.pageErrors ||
    report.idleApiReads ||
    report.outboundProviderAttempts ||
    !report.analysisNullGaps
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
