import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ProviderHttp } from '../../apps/api/src/bff/http.js';
import { Usage } from '../../apps/api/src/bff/usage.js';

const url = new URL('https://www.airnowapi.org/aq/data/');
const decode = (input: unknown) => z.array(z.number()).parse(input);
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
describe('bounded instrumented HTTP attempts (all mocked)', () => {
  it('counts retries, success/failure and latency exactly', async () => {
    let time = 0;
    const usage = new Usage(() => 0);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(json([0]));
    const sleep = vi.fn(async () => {});
    const http = new ProviderHttp(usage, {
      fetch: fetcher,
      attempts: 3,
      now: () => (time += 10),
      sleep,
    });
    expect(await http.request('airnow', url, decode)).toEqual([0]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
    expect(usage.summary().providers[0]).toMatchObject({
      requests: 3,
      successes: 1,
      failures: 2,
      totalLatencyMs: 30,
      averageLatencyMs: 10,
    });
    expect(usage.summary().startedAt).toBe('1970-01-01T00:00:00.000Z');
  });
  it('honors a long Retry-After without an early retry', async () => {
    const usage = new Usage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('', { status: 429, headers: { 'retry-after': '30' } }),
      );
    const http = new ProviderHttp(usage, {
      fetch: fetcher,
      attempts: 3,
      sleep: async () => {},
    });
    await expect(http.request('airnow', url, decode)).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMITED',
      retryable: true,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(usage.summary().providers[0]).toMatchObject({
      requests: 1,
      failures: 1,
    });
  });
  it('caps short 429 retries and preserves the rate-limit error code', async () => {
    const usage = new Usage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response('', { status: 429, headers: { 'retry-after': '0' } }),
      );
    await expect(
      new ProviderHttp(usage, {
        fetch: fetcher,
        attempts: 2,
        sleep: async () => {},
      }).request('airnow', url, decode),
    ).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMITED' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(usage.summary().providers[0]).toMatchObject({
      requests: 2,
      failures: 2,
      successes: 0,
    });
  });
  it('does not retry a rejected request or expose its body', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('API_KEY=TOP_SECRET', { status: 403 }));
    const promise = new ProviderHttp(new Usage(), { fetch: fetcher }).request(
      'airnow',
      url,
      decode,
    );
    await expect(promise).rejects.toMatchObject({ code: 'UPSTREAM_REJECTED' });
    await expect(promise).rejects.not.toThrow('TOP_SECRET');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([
    {
      response: () => new Response('<error>private upstream details</error>'),
      code: 'UPSTREAM_FORMAT',
    },
    { response: () => json({ wrong: true }), code: 'UPSTREAM_MALFORMED' },
    { response: () => json(['TOP_SECRET']), code: 'UPSTREAM_MALFORMED' },
    {
      response: () => new Response(new Uint8Array(2_000_001)),
      code: 'UPSTREAM_TOO_LARGE',
    },
  ])(
    'distinguishes a malformed/oversized body: $code',
    async ({ response, code }) => {
      const usage = new Usage();
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
      const promise = new ProviderHttp(usage, {
        fetch: fetcher,
        secrets: ['TOP_SECRET'],
      }).request('airnow', url, decode);
      await expect(promise).rejects.toMatchObject({ code });
      expect(usage.summary().providers[0]).toMatchObject({
        requests: 1,
        failures: 1,
        successes: 0,
      });
    },
  );
  it('counts a valid empty payload as a successful attempt', async () => {
    const usage = new Usage();
    expect(
      await new ProviderHttp(usage, {
        fetch: vi.fn<typeof fetch>().mockResolvedValue(json([])),
      }).request('airnow', url, decode),
    ).toEqual([]);
    expect(usage.summary().providers[0]).toMatchObject({
      successes: 1,
      failures: 0,
    });
  });
  it('rejects escaped reflected credentials even when the decoded shape would otherwise be valid', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('"TOP_\\u0053ECRET"'));
    const http = new ProviderHttp(new Usage(), {
      fetch: fetcher,
      secrets: ['TOP_SECRET'],
    });
    await expect(
      http.request('airnow', url, (input) => z.string().parse(input)),
    ).rejects.toMatchObject({ code: 'UPSTREAM_MALFORMED' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('bounds a hanging provider, aborts each attempt and counts failures', async () => {
    const usage = new Usage();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      signals.push(init!.signal!);
      return new Promise(() => {});
    });
    await expect(
      new ProviderHttp(usage, {
        fetch: fetcher,
        attempts: 2,
        timeoutMs: 10,
        sleep: async () => {},
      }).request('airnow', url, decode),
    ).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(usage.summary().providers[0]).toMatchObject({
      requests: 2,
      failures: 2,
      successes: 0,
    });
  });
  it('redacts network errors and forbids redirect following', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new Error('https://secret.invalid?API_KEY=TOP_SECRET'),
      );
    const promise = new ProviderHttp(new Usage(), {
      fetch: fetcher,
      attempts: 1,
    }).request('airnow', url, decode);
    await expect(promise).rejects.toMatchObject({ code: 'UPSTREAM_NETWORK' });
    await expect(promise).rejects.not.toThrow('TOP_SECRET');
    expect(fetcher.mock.calls[0]![1]!.redirect).toBe('error');
  });
});
