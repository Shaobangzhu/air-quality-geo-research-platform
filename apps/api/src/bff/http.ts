import { BffError } from './errors.js';
import { Usage } from './usage.js';

export type Fetch = typeof fetch;
export class ProviderHttp {
  constructor(
    private readonly usage: Usage,
    private readonly options: {
      fetch?: Fetch;
      attempts?: number;
      timeoutMs?: number;
      sleep?: (ms: number) => Promise<void>;
      now?: () => number;
      secrets?: string[];
    } = {},
  ) {}
  async request<T>(
    provider: 'airnow' | 'aqs',
    url: URL,
    decode: (input: unknown) => T,
  ): Promise<T> {
    const attempts = Math.max(1, Math.min(3, this.options.attempts ?? 2));
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const now = this.options.now ?? (() => performance.now());
      const start = now();
      let success = false;
      let complete: ReturnType<Usage['startAttempt']> | undefined;
      let retryDelay = Math.min(100 * 2 ** attempt, 1000);
      let retryPermitted = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const operation = async () => {
          let response: Response;
          try {
            complete = this.usage.startAttempt(provider);
            response = await (this.options.fetch ?? fetch)(url, {
              signal: controller.signal,
              redirect: 'error',
              headers: { Accept: 'application/json' },
            });
          } catch {
            if (controller.signal.aborted)
              throw new BffError('UPSTREAM_TIMEOUT', 504, true);
            throw new BffError('UPSTREAM_NETWORK', 502, true);
          }
          if (!response.ok) {
            await response.body?.cancel();
            if (response.status === 429) {
              const raw = response.headers.get('retry-after');
              const seconds =
                raw && /^\d+$/.test(raw)
                  ? Number(raw)
                  : raw
                    ? (Date.parse(raw) - Date.now()) / 1000
                    : 0;
              // Never retry earlier than Retry-After; a longer delay ends this bounded request.
              if (seconds > 1) {
                retryPermitted = false;
                throw new BffError('UPSTREAM_RATE_LIMITED', 503, true);
              }
              if (Number.isFinite(seconds) && seconds > 0)
                retryDelay = seconds * 1000;
              throw new BffError('UPSTREAM_RATE_LIMITED', 503, true);
            }
            if (response.status >= 500)
              throw new BffError('UPSTREAM_SERVER_ERROR', 502, true);
            throw new BffError('UPSTREAM_REJECTED', 502);
          }
          const maxBytes = 2_000_000;
          if (Number(response.headers.get('content-length')) > maxBytes) {
            await response.body?.cancel();
            throw new BffError('UPSTREAM_TOO_LARGE', 502);
          }
          const reader = response.body?.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          if (reader) {
            try {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > maxBytes) {
                  await reader.cancel();
                  throw new BffError('UPSTREAM_TOO_LARGE', 502);
                }
                chunks.push(chunk.value);
              }
            } finally {
              reader.releaseLock();
            }
          }
          const text = Buffer.concat(chunks).toString('utf8');
          if (
            this.options.secrets?.some(
              (secret) => secret && text.includes(secret),
            )
          )
            throw new BffError('UPSTREAM_MALFORMED', 502);
          let input: unknown;
          try {
            input = JSON.parse(text);
          } catch {
            throw new BffError('UPSTREAM_FORMAT', 502);
          }
          const decodedText = JSON.stringify(input);
          if (
            this.options.secrets?.some(
              (secret) => secret && decodedText.includes(secret),
            )
          )
            throw new BffError('UPSTREAM_MALFORMED', 502);
          try {
            return decode(input);
          } catch (error) {
            if (error instanceof BffError) throw error;
            throw new BffError('UPSTREAM_MALFORMED', 502);
          }
        };
        const timeout = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => {
              controller.abort();
              reject(new BffError('UPSTREAM_TIMEOUT', 504, true));
            },
            Math.max(10, Math.min(10_000, this.options.timeoutMs ?? 3000)),
          );
        });
        const value = await Promise.race([operation(), timeout]);
        success = true;
        return value;
      } catch (error) {
        const failure =
          error instanceof BffError
            ? error
            : controller.signal.aborted
              ? new BffError('UPSTREAM_TIMEOUT', 504, true)
              : new BffError('UPSTREAM_NETWORK', 502, true);
        if (!failure.retryable || !retryPermitted || attempt + 1 >= attempts)
          throw failure;
      } finally {
        if (timer) clearTimeout(timer);
        complete?.(success, now() - start);
      }
      await (
        this.options.sleep ??
        ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
      )(retryDelay);
    }
    throw new BffError('UPSTREAM_NETWORK', 502);
  }
}
