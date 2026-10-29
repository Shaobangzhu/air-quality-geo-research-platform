import { DataWorkbench } from './data/workbench.js';
import { loadWildfireCase } from './wildfire/case.js';
import type { WildfireCase } from '@aq/contracts';
import express from 'express';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { DatabaseStatus } from '@aq/contracts';
import { healthSchema } from '@aq/contracts';
import type { Config } from './config.js';
import type { AreaProductService } from './bff/area-service.js';
import type { BffService } from './bff/service.js';
import { BffError, safeError } from './bff/errors.js';
import { errorEnvelopeSchema } from '@aq/contracts';
import { researchRequestSchema } from '@aq/contracts';
import type { ResearchAssistant } from './assistant/service.js';

export function createApp(options: {
  config: Pick<Config, 'DATA_MODE'>;
  databaseStatus: () => Promise<DatabaseStatus>;
  bff?: BffService;
  areas?: AreaProductService;
  data?: DataWorkbench;
  assistant?: ResearchAssistant;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/research/status', (_req, res) =>
    res
      .set('Cache-Control', 'no-store')
      .json({ enabled: options.assistant?.enabled ?? false }),
  );
  app.post(
    '/api/research/answer',
    (req, res, next) => {
      const origin = req.get('origin');
      if (
        req.get('x-research-request') !== '1' ||
        (origin && !/^http:\/\/(127\.0\.0\.1|localhost):517[34]$/.test(origin))
      ) {
        res.status(403).json({ error: 'Research request rejected.' });
        return;
      }
      next();
    },
    express.json({ limit: '4kb' }),
    async (req, res) => {
      const input = researchRequestSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({ error: 'Invalid research context.' });
        return;
      }
      if (!options.assistant) {
        res.status(503).json({ error: 'Research Assistant disabled.' });
        return;
      }
      res
        .set('Cache-Control', 'no-store')
        .json(await options.assistant.ask(input.data));
    },
  );
  let wildfire: WildfireCase | undefined;
  app.get('/api/wildfire/eaton-fire-2025', (req, res) => {
    if (
      Object.keys(req.query).some((k) => k !== 'mode') ||
      (req.query.mode !== undefined &&
        !['historical', 'sample', 'live'].includes(String(req.query.mode))) ||
      Array.isArray(req.query.mode)
    )
      throw new BffError('INVALID_REQUEST', 400);
    res.set('Cache-Control', 'no-store');
    if (req.query.mode && req.query.mode !== 'historical') {
      res.status(409).json({
        state: 'unavailable',
        reason:
          'This curated case is historical only. No live or synthetic fallback.',
      });
      return;
    }
    try {
      wildfire ??= loadWildfireCase();
      res.json(wildfire);
    } catch {
      res.status(503).json({
        state: 'blocked',
        reason:
          'Historical case assets are missing or failed provenance/geometry validation.',
      });
    }
  });

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
    const workbench = options.data ?? new DataWorkbench(bff, options.areas);
    app.get('/api/data/catalog', (req, res) => {
      if (Object.keys(req.query).length)
        throw new BffError('INVALID_REQUEST', 400);
      return workbench
        .catalog()
        .then((result) => res.set('Cache-Control', 'no-store').json(result));
    });
    app.get('/api/data/preview', async (req, res) =>
      res
        .set('Cache-Control', 'no-store')
        .json(await workbench.preview(req.query)),
    );
    app.get('/api/exports/:format', async (req, res) => {
      if (!['json', 'csv'].includes(req.params.format))
        throw new BffError('INVALID_REQUEST', 400);
      const result = await workbench.export(
        req.params.format as 'json' | 'csv',
        req.query,
      );
      res
        .set({
          'Cache-Control': 'no-store',
          'Content-Type': result.type,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'X-Content-Type-Options': 'nosniff',
        })
        .send(result.body);
    });

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
    app.get('/api/station-readings', async (req, res) => {
      res
        .set('Cache-Control', 'no-store')
        .json(await bff.stationReadings(req.query));
    });
    app.get('/api/analysis-series', async (req, res) => {
      res.set('Cache-Control', 'no-store').json(await bff.analysis(req.query));
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
  if (options.areas) {
    app.get('/api/reporting-area-aqi', async (req, res) =>
      res
        .set('Cache-Control', 'no-store')
        .json(await options.areas!.read('reporting-area-aqi', req.query)),
    );
    app.get('/api/forecasts', async (req, res) =>
      res
        .set('Cache-Control', 'no-store')
        .json(await options.areas!.read('forecast', req.query)),
    );
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
