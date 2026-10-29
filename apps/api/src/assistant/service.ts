import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  analysisSeriesResponseSchema,
  researchAnswerSchema,
  researchIntentSchema,
  researchQuestions,
  researchRequestSchema,
} from '@aq/contracts';
import type { ResearchAnswer, ResearchRequest } from '@aq/contracts';
import type { BffService } from '../bff/service.js';

export const intentInput = z.strictObject({ intent: researchIntentSchema });
export const toolDefinition = {
  name: 'get_selected_station_series',
  description:
    'Read only the server-bound selected stations (1–3), region, metric and pinned 24/48/72-hour window. summary gives verified ranges; missingness gives gaps/freshness; comparison gives compatible station ranges. Cannot change scope, write data or fetch URLs.',
  schema: intentInput,
};
export const routingPrompt =
  'Select exactly one get_selected_station_series call for the supplied supported question. Choose summary, missingness or comparison. Do not answer with facts or invent arguments. No other tools are available.';
export type ModelResult = {
  calls: { name: string; args: unknown }[];
  inputTokens?: number;
  outputTokens?: number;
};
export type ResearchModel = (
  question: string,
  signal: AbortSignal,
) => Promise<ModelResult>;

export class ResearchAssistant {
  private active = 0;
  private attempts: number[] = [];
  constructor(
    private bff: Pick<BffService, 'analysis'>,
    private model?: ResearchModel,
    private settings: {
      timeoutMs?: number;
      now?: () => number;
      secrets?: string[];
    } = {},
  ) {}
  get enabled() {
    return !!this.model;
  }
  async ask(input: unknown): Promise<ResearchAnswer> {
    const request = researchRequestSchema.parse(input);
    const base = (
      status: ResearchAnswer['status'],
      shortAnswer: ResearchAnswer['shortAnswer'],
    ): ResearchAnswer => ({
      question: request.question,
      status,
      shortAnswer,
      generatedAt: new Date().toISOString(),
      evidence: null,
      citations: [],
      limitations: [],
    });
    if (!this.model)
      return base(
        'disabled',
        'Research Assistant is disabled. Configure it on the local server.',
      );
    const intent = (
      Object.keys(researchQuestions) as (keyof typeof researchQuestions)[]
    ).find((k) => researchQuestions[k] === request.question);
    if (
      !intent ||
      request.context.mode === 'live' ||
      (request.context.mode === 'historical' && !request.context.snapshotId) ||
      (intent === 'comparison' && request.context.stationIds.length < 2)
    )
      return base(
        'unsupported',
        'This question or data mode is outside the supported research scope.',
      );
    const now = (this.settings.now ?? Date.now)();
    this.attempts = this.attempts.filter((t) => now - t < 60000);
    const failure = () =>
      base(
        'unavailable',
        'Research Assistant could not verify an answer. Try again later.',
      );
    if (this.active >= 2 || this.attempts.length >= 6) return failure();
    this.active++;
    this.attempts.push(now);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const work = async () => {
      const proposed = await this.model!(request.question, controller.signal);
      if (
        controller.signal.aborted ||
        proposed.calls.length !== 1 ||
        (proposed.outputTokens ?? 0) > 512 ||
        (proposed.inputTokens ?? 0) > 4096
      )
        throw new Error('Invalid bounded model result');
      const call = proposed.calls[0]!;
      if (
        call.name !== toolDefinition.name ||
        intentInput.parse(call.args).intent !== intent
      )
        throw new Error('Unsupported tool request');
      // Scope is server-bound, never derived from model arguments. Results are
      // untrusted data and are never sent back to the model for another turn.
      const read = tool(async (args) => {
        intentInput.parse(args);
        if (controller.signal.aborted) throw new Error('Cancelled');
        return this.read(request);
      }, toolDefinition);
      const result = await read.invoke(
        call.args as z.infer<typeof intentInput>,
      );
      if (controller.signal.aborted) throw new Error('Cancelled');
      const evidence = analysisSeriesResponseSchema.parse(result);
      const useful = evidence.series.some(
        (s) => s.summary && s.summary.availableCount > 0,
      );
      const partial =
        evidence.meta.cache.status === 'stale' ||
        evidence.meta.delayed === true ||
        evidence.missingStationIds.length > 0 ||
        evidence.series.some(
          (s) =>
            !s.summary ||
            s.summary.missingCount > 0 ||
            s.summary.conflictCount > 0,
        );
      const answer: ResearchAnswer = {
        ...base(
          !useful ? 'insufficient' : partial ? 'partial' : 'grounded',
          !useful
            ? 'Insufficient evidence for this selection.'
            : intent === 'summary'
              ? 'Verified station ranges and coverage are shown below.'
              : intent === 'missingness'
                ? 'Missingness and cache freshness are shown below; missing is not zero.'
                : 'Compare only the compatible station ranges below; no regional AQI is calculated.',
        ),
        evidence,
        citations: evidence.series.map((s) => ({
          type: 'data',
          id: s.station.id,
        })),
        limitations: [
          'Only the selected monitors and supplied hours are represented; no regional AQI, causal or regulatory inference.',
          'Null, absent, conflicting and outside-coverage hours are distinct; no interpolation or unit conversion.',
          'Sample is synthetic. Official source provenance does not establish row certification. Inspect each record’s source status.',
          'Freshness describes the supplied data/cache, not a verified current environmental condition.',
        ],
      };
      const text = JSON.stringify(answer);
      if (
        Buffer.byteLength(text) > 1_000_000 ||
        this.settings.secrets?.some((s) => s && text.includes(s))
      )
        throw new Error('Unsafe evidence');
      return researchAnswerSchema.parse(answer);
    };
    // Hold the concurrency slot until underlying work actually settles, even
    // if a non-cooperative dependency outlives the HTTP response deadline.
    const pending = work().finally(() => {
      this.active--;
    });
    try {
      return await Promise.race([
        pending,
        new Promise<ResearchAnswer>((resolve) => {
          timer = setTimeout(() => {
            controller.abort();
            resolve(failure());
          }, this.settings.timeoutMs ?? 15000);
        }),
      ]);
    } catch {
      return failure();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  private async read(request: ResearchRequest) {
    const c = request.context;
    const data = analysisSeriesResponseSchema.parse(
      await this.bff.analysis({
        ...c,
        windowHours: String(c.windowHours),
        stationIds: c.stationIds.join(','),
      }),
    );
    if (
      data.meta.region !== c.region ||
      data.meta.dataMode !== c.mode ||
      data.meta.pollutant !== c.pollutant ||
      data.meta.measurementType !== c.measurementType ||
      Date.parse(data.meta.window.to) !== Date.parse(c.endAt) ||
      data.windowHours !== c.windowHours ||
      (c.snapshotId && data.meta.snapshotId !== c.snapshotId) ||
      data.primaryId !== c.stationIds[0] ||
      data.series.some((s) => !c.stationIds.includes(s.station.id)) ||
      data.missingStationIds.some((id) => !c.stationIds.includes(id)) ||
      data.series.length + data.missingStationIds.length !==
        c.stationIds.length ||
      data.series.reduce((n, s) => n + s.records.length, 0) > 500
    )
      throw new Error('Mismatched evidence');
    return data;
  }
}
