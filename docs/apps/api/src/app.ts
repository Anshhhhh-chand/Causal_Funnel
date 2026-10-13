import cors from 'cors';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import type { Repository } from './repository.js';
import { decodeCursor, RepositoryUnavailableError } from './repository.js';
import { normalizePageUrl, validateAndNormalizeEvent } from './validation.js';
import { z } from 'zod';

export interface AppOptions {
  repository: Repository;
  clientOrigins?: string[];
  maxEventAgeHours?: number;
}

function parseLimit(raw: unknown, fallback: number, maximum: number): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error('limit must be a positive integer');
  return Math.min(parsed, maximum);
}

function sendError(response: Response, status: number, code: string, message: string, fields?: unknown[]) {
  response.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

export function createApp({ repository, clientOrigins = [], maxEventAgeHours = 168 }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.length === 0 || clientOrigins.includes('*') || clientOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Origin is not allowed'));
    },
  }));
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use((request, response, next) => {
    const requestId = request.header('x-request-id') ?? randomUUID();
    response.setHeader('x-request-id', requestId);
    next();
  });

  app.get('/health', (_request, response) => {
    response.status(repository.ready ? 200 : 503).json({ status: repository.ready ? 'ok' : 'degraded', database: repository.ready ? 'connected' : 'unavailable' });
  });

  const api = express.Router();

  api.post('/events', async (request, response, next) => {
    try {
      const event = validateAndNormalizeEvent(request.body, maxEventAgeHours);
      const result = await repository.insertEvent(event);
      response.status(result.duplicate ? 200 : 202).json({ accepted: true, duplicate: result.duplicate, eventId: result.id });
    } catch (error) {
      next(error);
    }
  });

  api.get('/sessions', async (request, response, next) => {
    try {
      const limit = parseLimit(request.query.limit, 50, 100);
      const cursor = decodeCursor<{ time: string; sessionId: string }>(typeof request.query.cursor === 'string' ? request.query.cursor : undefined);
      const result = await repository.listSessions({ limit, cursor, siteId: typeof request.query.siteId === 'string' ? request.query.siteId : undefined });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  api.get('/sessions/:sessionId/events', async (request, response, next) => {
    try {
      const sessionId = z.string().uuid().parse(request.params.sessionId);
      const limit = parseLimit(request.query.limit, 500, 1_000);
      const cursor = decodeCursor<{ time: string; id: string }>(typeof request.query.cursor === 'string' ? request.query.cursor : undefined);
      const result = await repository.listSessionEvents({ sessionId, limit, cursor });
      response.json({ sessionId, ...result });
    } catch (error) {
      next(error);
    }
  });

  api.get('/heatmap', async (request, response, next) => {
    try {
      const rawUrl = z.string().min(1).max(2_048).parse(request.query.url);
      const pageUrl = normalizePageUrl(rawUrl);
      const limit = parseLimit(request.query.limit, 10_000, 10_000);
      const result = await repository.listHeatmap({ pageUrl, limit, siteId: typeof request.query.siteId === 'string' ? request.query.siteId : undefined });
      response.json({ pageUrl, ...result });
    } catch (error) {
      next(error);
    }
  });

  api.get('/pages', async (request, response, next) => {
    try {
      const limit = parseLimit(request.query.limit, 100, 500);
      const result = await repository.listPages({ limit, siteId: typeof request.query.siteId === 'string' ? request.query.siteId : undefined });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', api);

  const errorHandler: ErrorRequestHandler = (error, _request: Request, response: Response, _next) => {
    if (response.headersSent) return;
    if (error instanceof RepositoryUnavailableError) return sendError(response, 503, 'DATABASE_UNAVAILABLE', error.message);
    if (error instanceof z.ZodError) return sendError(response, 400, 'VALIDATION_ERROR', 'The request could not be validated', error.issues.map((issue) => ({ path: issue.path, message: issue.message })));
    if (error instanceof SyntaxError && 'body' in error) return sendError(response, 400, 'INVALID_JSON', 'The request body must be valid JSON');
    if (error instanceof Error && error.message === 'limit must be a positive integer') return sendError(response, 400, 'INVALID_QUERY', error.message);
    if (error instanceof Error && error.message === 'Invalid pagination cursor') return sendError(response, 400, 'INVALID_QUERY', error.message);
    console.error('Request failed:', error instanceof Error ? error.message : error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'The server could not complete the request');
  };
  app.use(errorHandler);
  return app;
}
