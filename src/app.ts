import express from 'express';
import cors from 'cors';
import config from './config';
import authRoutes from './routes/auth';
import playerRoutes from './routes/player';
import scoutRoutes from './routes/scout';
import validatorRoutes from './routes/validator';
import adminRoutes from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { securityHeaders } from './middleware/securityHeaders';
import { correlationId } from './middleware/correlationId';
import { traceId } from './middleware/traceId';
import { responseTime } from './middleware/responseTime';
import { stellarHealth } from './services/stellar';
import { checkHealth } from './services/ipfs';
import { API_PREFIX, API_V1_PREFIX } from './config';
import { metricsMiddleware, createMetricsHandler } from './middleware/metrics';
import { indexerLedgerLag } from './services/indexer';
import { getDb } from './db';

/** Probe the SQLite database with a lightweight SELECT 1.
 *  Resolves 'ok' or 'error'; never rejects.
 *  A configurable timeout (default 2 s) guards against a locked DB hanging the health check.
 */
async function probeDb(timeoutMs = 2_000): Promise<'ok' | 'error'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('error'), timeoutMs);
    try {
      getDb().prepare('SELECT 1').get();
      clearTimeout(timer);
      resolve('ok');
    } catch {
      clearTimeout(timer);
      resolve('error');
    }
  });
}

const app = express();

const corsOrigin =
  config.nodeEnv !== 'development' && config.allowedOrigins.length > 0
    ? config.allowedOrigins
    : '*';
app.use(cors({ origin: corsOrigin }));
app.use(correlationId);
app.use(traceId);
app.use(securityHeaders);
app.use(responseTime);
// Configure Express body parser with JSON payload size limit
// Returns 413 Payload Too Large if exceeded
app.use(express.json({ limit: config.bodyLimit.json }));
app.use(requestLogger);
// Collect per-route request counts, latency, and error counts for /metrics.
app.use(metricsMiddleware);

app.get('/health', async (_req, res) => {
  const healthStatus: Record<string, 'ok' | 'error' | 'disabled'> = {};

  if (config.stellarHealthCheckEnabled) {
    const stellarOk = await stellarHealth();
    healthStatus.stellar = stellarOk ? 'ok' : 'error';
  } else {
    healthStatus.stellar = 'disabled';
  }

  healthStatus.db = await probeDb();

  res.json({ status: 'ok', healthStatus });
});

async function checkReadiness(): Promise<Record<string, 'ok' | 'unavailable' | 'disabled'>> {
  const services: Record<string, 'ok' | 'unavailable' | 'disabled'> = {};

  try {
    await checkHealth();
    services.ipfs = 'ok';
  } catch {
    services.ipfs = 'unavailable';
  }

  if (config.stellarHealthCheckEnabled) {
    try {
      const stellarOk = await stellarHealth();
      services.stellar = stellarOk ? 'ok' : 'unavailable';
    } catch {
      services.stellar = 'unavailable';
    }
  } else {
    services.stellar = 'disabled';
  }

  return services;
}

app.get('/ready', async (_req, res) => {
  const services = await checkReadiness();
  const allOk = Object.values(services).every(v => v === 'ok' || v === 'disabled');
  if (allOk) {
    res.json({ status: 'ok', services });
  } else {
    res.status(503).json({ status: 'degraded', services });
  }
});

// Kubernetes-style liveness and readiness probes
app.get('/health/liveness', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/readiness', async (_req, res) => {
  const services = await checkReadiness();
  const allOk = Object.values(services).every(v => v === 'ok' || v === 'disabled');
  if (allOk) {
    res.json({ status: 'ok', services });
  } else {
    res.status(503).json({ status: 'degraded', services });
  }
});

// Prometheus scrape endpoint. Intentionally unauthenticated and not rate-limited
// (standard scrape pattern): it is registered before the auth routes and is not
// wrapped by any auth or rate-limit middleware.
app.get('/metrics', createMetricsHandler(() => indexerLedgerLag));

app.use('/auth', authRoutes);

// Mount API routes under both /api (backwards-compatible alias) and /api/v1
const prefixes = [API_PREFIX, API_V1_PREFIX];
for (const prefix of prefixes) {
  app.use(`${prefix}/players`, playerRoutes);
  app.use(`${prefix}/scouts`, scoutRoutes);
  app.use(`${prefix}/validators`, validatorRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
}

// Catch-all 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

export default app;
