import { test, expect } from '@playwright/test';
import {
  documentChunkSchema,
  researchQuestions,
  researchRequestSchema,
} from '@aq/contracts';
test('lists reviewed methodology sources inside the existing Data page', async ({
  page,
}) => {
  await page.goto('/data?tab=sources');
  await page
    .getByText('Research Assistant methodology sources', { exact: true })
    .click();
  await expect(
    page.getByText('Methodology references only; not observation providers.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'About the Data', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: 'AirData Download Files Documentation',
      exact: true,
    }),
  ).toBeVisible();
});
test('renders distinct data and document citations with a mocked model answer and real local evidence', async ({
  page,
}) => {
  await page.route('**/api/research/status', (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route('**/api/research/answer', async (route) => {
    const input = researchRequestSchema.parse(route.request().postDataJSON());
    const c = input.context;
    const params = new URLSearchParams({
      region: c.region,
      pollutant: c.pollutant,
      measurementType: c.measurementType,
      mode: c.mode,
      windowHours: String(c.windowHours),
      endAt: c.endAt,
      stationIds: c.stationIds.join(','),
    });
    const evidence = await (
      await page.request.get('/api/analysis-series?' + params)
    ).json();
    const chunks = documentChunkSchema
      .array()
      .parse(await (await page.request.get('/api/research/corpus')).json())
      .filter((c) => c.topic === 'validity');
    await route.fulfill({
      json: {
        question: input.question,
        status: 'partial',
        shortAnswer:
          'Selected observations and independent methodology evidence are shown below.',
        generatedAt: new Date().toISOString(),
        evidence,
        citations: evidence.series.map((s: { station: { id: string } }) => ({
          type: 'data',
          id: s.station.id,
        })),
        documents: {
          indexVersion: 'local-hash-tf-512-v1',
          corpusVersion: 'methodology-v1',
          chunks,
          citations: chunks.map((c) => ({ type: 'document', id: c.id })),
        },
        limitations: ['No regulatory conclusion; sample is synthetic.'],
      },
    });
  });
  await page.goto('/analysis?mode=sample');
  await page.getByLabel('Inspect observation time').waitFor();
  await page
    .getByText('Research Assistant · optional · open to check configuration')
    .click();
  await page
    .getByLabel('Research question')
    .selectOption(researchQuestions.combined);
  await page.getByRole('button', { name: 'Ask Research Assistant' }).click();
  await expect(
    page.getByRole('region', { name: 'Methodology document evidence' }),
  ).toBeVisible();
  await expect(page.getByText(/Evidence ID: s_/)).toBeVisible();
  await expect(page.getByText(/Document citation: doc_/)).toBeVisible();
  await expect(
    page.getByText('No regulatory conclusion; sample is synthetic.'),
  ).toBeVisible();
});
