import { loadEnvironment } from '../apps/api/src/environment.js';
import { readConfig } from '../apps/api/src/config.js';
import { createBff } from '../apps/api/src/bff/runtime.js';
import { openAIResearchModel } from '../apps/api/src/assistant/model.js';
import { ResearchAssistant } from '../apps/api/src/assistant/service.js';
import { researchQuestions } from '@aq/contracts';
loadEnvironment();
try {
  const config = readConfig();
  if (!config.ALLOW_LIVE_LLM_TESTS || !config.OPENAI_API_KEY)
    throw new Error('Opt-in required');
  const bff = createBff({
    ...config,
    DATA_MODE: 'sample',
    DATABASE_URL: undefined,
  });
  const data = await bff.analysis({ mode: 'sample' });
  const model = openAIResearchModel(config.OPENAI_API_KEY);
  let usage: { inputTokens?: number; outputTokens?: number } = {};
  const assistant = new ResearchAssistant(bff, async (q, s) => {
    const r = await model(q, s);
    usage = {
      ...(r.inputTokens === undefined ? {} : { inputTokens: r.inputTokens }),
      ...(r.outputTokens === undefined ? {} : { outputTokens: r.outputTokens }),
    };
    return r;
  });
  const answer = await assistant.ask({
    question: researchQuestions.summary,
    context: {
      region: data.meta.region,
      pollutant: data.meta.pollutant,
      measurementType: data.meta.measurementType,
      mode: 'sample',
      windowHours: data.windowHours,
      endAt: data.meta.window.to,
      stationIds: data.series.map((s) => s.station.id),
    },
  });
  console.info(
    JSON.stringify({
      status: answer.status,
      evidenceCount: answer.citations.length,
      measuredTokens: usage,
    }),
  );
  if (!['grounded', 'partial'].includes(answer.status)) process.exitCode = 1;
} catch {
  console.error(
    'Research smoke unavailable. Requires ALLOW_LIVE_LLM_TESTS=true and server key; no raw errors are logged.',
  );
  process.exitCode = 1;
}
