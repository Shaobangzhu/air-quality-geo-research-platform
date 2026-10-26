import express from 'express';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { DatabaseStatus } from '@aq/contracts';
import { healthSchema } from '@aq/contracts';
import type { Config } from './config.js';
import type { BffService } from './bff/service.js';
import { BffError, safeError } from './bff/errors.js';
import { errorEnvelopeSchema } from '@aq/contracts';

export function createApp(options: {
  config: Pick<Config, 'DATA_MODE'>;
  databaseStatus: () => Promise<DatabaseStatus>;
  bff?: BffService;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', async (_req, res) => {
    let database: DatabaseStatus;
    try {
      database = await options.databaseStatus();
    } catch {
      database = 'unavailable';
    }
    res.set('Cache-Control', 'no-store').json(
      healthSchema.parse({
        service: 'aq-research-api',
        status: 'ok',
        database,
        data: options.bff?.health() ?? {
          mode: options.config.DATA_MODE,
          state: 'unavailable',
          reason: 'foundation-only',
        },
      }),
    );
  });
  if (options.bff) {
    const bff = options.bff;
    const noQuery: RequestHandler = (req, _res, next) => {
      if (Object.keys(req.query).length)
        next(new BffError('INVALID_REQUEST', 400));
      else next();
    };
    app.get('/api/regions', noQuery, (_req, res) => {
      res.json(bff.regions());
    });
    app.get('/api/data-products', noQuery, (_req, res) => {
      res.json(bff.products());
    });
    app.get('/api/stations', async (req, res) => {
      res.set('Cache-Control', 'no-store').json(await bff.stations(req.query));
    });
    app.get('/api/stations/:id/observations', async (req, res) => {
      res
        .set('Cache-Control', 'no-store')
        .json(await bff.observations(req.params.id, req.query));
    });
    app.get('/api/datasets', async (req, res) => {
      res.json(await bff.datasets(req.query));
    });
    app.get('/api/usage/summary', noQuery, (_req, res) => {
      res.set('Cache-Control', 'no-store').json(bff.usage());
    });
  }
  app.use((_req, res) => {
    res.status(404).json(
      errorEnvelopeSchema.parse({
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Unknown API route.',
          retryable: false,
        },
      }),
    );
  });
  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    const failure =
      error instanceof URIError
        ? new BffError('INVALID_REQUEST', 400)
        : safeError(error);
    if (res.headersSent) {
      _next(failure);
      return;
    }
    res
      .status(failure.status)
      .set('Cache-Control', 'no-store')
      .json(
        errorEnvelopeSchema.parse({
          error: {
            code: failure.code,
            message: failure.message,
            retryable: failure.retryable,
          },
        }),
      );
  };
  app.use(errorHandler);
  return app;
}
