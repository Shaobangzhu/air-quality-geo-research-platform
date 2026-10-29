import { afterEach, expect, it, vi } from 'vitest';
import { researchQuestions } from '@aq/contracts';
const fake = vi.hoisted(() => ({
  invoke: vi.fn(),
  bind: vi.fn(),
  config: vi.fn(),
}));
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(options: unknown) {
      fake.config(options);
    }
    bindTools(...args: unknown[]) {
      fake.bind(...args);
      return { invoke: fake.invoke };
    }
  },
}));
import {
  openAIResearchModel,
  RESEARCH_MODEL,
} from '../../apps/api/src/assistant/model.js';
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it('uses a pinned model, strict single-tool calling, fixed endpoint, no retries and bounded output', async () => {
  fake.invoke.mockResolvedValue({
    tool_calls: [
      { name: 'get_selected_station_series', args: { intent: 'summary' } },
    ],
    usage_metadata: { input_tokens: 200, output_tokens: 25 },
  });
  const result = await openAIResearchModel('server-test-key')(
    researchQuestions.summary,
    new AbortController().signal,
  );
  expect(fake.config).toHaveBeenCalledWith(
    expect.objectContaining({
      model: RESEARCH_MODEL,
      maxTokens: 512,
      maxRetries: 0,
      timeout: 12000,
      verbose: false,
      configuration: { baseURL: 'https://api.openai.com/v1', logLevel: 'off' },
    }),
  );
  expect(fake.bind.mock.calls[0]?.[1]).toEqual({
    strict: true,
    parallel_tool_calls: false,
  });
  expect(result).toMatchObject({ inputTokens: 200, outputTokens: 25 });
  expect(JSON.stringify(fake.invoke.mock.calls)).not.toContain(
    'server-test-key',
  );
});
it('refuses ambient tracing and oversized input before model invocation', async () => {
  const model = openAIResearchModel('server-test-key');
  vi.stubEnv('LANGSMITH_TRACING', 'true');
  await expect(
    model(researchQuestions.summary, new AbortController().signal),
  ).rejects.toThrow('External tracing');
  vi.stubEnv('LANGSMITH_TRACING', 'false');
  await expect(
    model('a'.repeat(4000), new AbortController().signal),
  ).rejects.toThrow('Input budget');
  expect(fake.invoke).not.toHaveBeenCalled();
});
it('rejects malformed SDK tool calls without using generated narrative', async () => {
  fake.invoke.mockResolvedValue({
    invalid_tool_calls: [{ args: 'invalid' }],
    content: 'Invented 99 AQI',
  });
  await expect(
    openAIResearchModel('server-test-key')(
      researchQuestions.summary,
      new AbortController().signal,
    ),
  ).rejects.toThrow('Invalid tool calls');
});
