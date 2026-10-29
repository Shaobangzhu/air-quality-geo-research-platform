import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ResearchAssistant } from './ResearchAssistant.js';
import {
  ResearchAssistant as Service,
  toolDefinition,
} from '../../../api/src/assistant/service.js';
import { harness } from '../../../../tests/helpers/bff.js';
import fixture from '../../../../fixtures/synthetic/bff-hourly.json';
import { SampleProvider } from '../../../api/src/bff/providers.js';
afterEach(() => vi.unstubAllGlobals());
async function setup(enabled: boolean) {
  const h = harness({ sample: new SampleProvider(fixture) });
  const data = await h.service.analysis({ mode: 'sample' });
  const service = new Service(h.service, async () => ({
    calls: [{ name: toolDefinition.name, args: { intent: 'summary' } }],
  }));
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => ({
    ok: true,
    json: async () =>
      url.endsWith('/status')
        ? { enabled }
        : service.ask(JSON.parse(options!.body as string)),
  }));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<ResearchAssistant data={data} />);
  return { ...view, fetcher };
}
it('leaves V1 passive browsing untouched and shows disabled configuration on demand', async () => {
  const { fetcher } = await setup(false);
  expect(fetcher).not.toHaveBeenCalled();
  const panel = screen.getByLabelText(
    'Optional Research Assistant',
  ) as HTMLDetailsElement;
  panel.open = true;
  fireEvent(panel, new Event('toggle'));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(
    screen.getByRole('button', { name: 'Ask Research Assistant' }),
  ).toBeDisabled();
  expect(
    screen.getByText(/No model request is made while disabled/),
  ).toBeInTheDocument();
});
it('submits pinned context and renders verified citations and raw source records', async () => {
  const { fetcher } = await setup(true);
  const panel = screen.getByLabelText(
    'Optional Research Assistant',
  ) as HTMLDetailsElement;
  panel.open = true;
  fireEvent(panel, new Event('toggle'));
  const button = screen.getByRole('button', { name: 'Ask Research Assistant' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByText(/Verified station ranges and coverage/);
  expect(screen.getByText(/Evidence ID:/)).toBeInTheDocument();
  expect(
    screen.getByText(/Inspect cited source records and periods/),
  ).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
