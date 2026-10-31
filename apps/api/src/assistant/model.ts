import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import {
  intentInput,
  routingPrompt,
  toolDefinition,
  documentToolDefinition,
} from './service.js';
import type { ResearchModel } from './service.js';
import { z } from 'zod';

export const RESEARCH_MODEL = 'gpt-4.1-mini-2025-04-14';
export function openAIResearchModel(apiKey: string): ResearchModel {
  // Explicit endpoint prevents ambient proxy/base-URL configuration from
  // forwarding credentials elsewhere. No callbacks/tracing or provider tools.
  const model = new ChatOpenAI({
    apiKey,
    model: RESEARCH_MODEL,
    temperature: 0,
    maxTokens: 512,
    maxRetries: 0,
    timeout: 12000,
    verbose: false,
    configuration: { baseURL: 'https://api.openai.com/v1', logLevel: 'off' },
  }).bindTools(
    [
      tool(() => 'Server executes after validation.', toolDefinition),
      tool(() => 'Server executes after validation.', documentToolDefinition),
    ],
    { strict: true, parallel_tool_calls: false },
  );
  return async (question, signal) => {
    if (
      ['LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGSMITH_TRACING'].some(
        (k) => process.env[k] && process.env[k] !== 'false',
      )
    )
      throw new Error('External tracing disabled for research');
    // Only a fixed allowlisted question and static tool schema leave the host.
    if (
      Buffer.byteLength(
        JSON.stringify({
          prompt: routingPrompt,
          question,
          name: toolDefinition.name,
          description: toolDefinition.description,
          schema: z.toJSONSchema(intentInput),
          documentTool: {
            name: documentToolDefinition.name,
            description: documentToolDefinition.description,
            schema: z.toJSONSchema(intentInput),
          },
        }),
      ) > 3072
    )
      throw new Error('Input budget');
    const result = await model.invoke(
      [
        { role: 'system', content: routingPrompt },
        { role: 'user', content: question },
      ],
      { signal, callbacks: [] },
    );
    if (result.invalid_tool_calls?.length)
      throw new Error('Invalid tool calls');
    const usage = z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .optional()
      .parse(result.usage_metadata as unknown);
    return {
      calls: result.tool_calls ?? [],
      ...(usage
        ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
        : {}),
    };
  };
}
