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
import { responseTime } from './middleware/responseTime';
import { stellarHealth } from './services/stellar';
import { checkHealth } from './services/ipfs';
import { API_PREFIX, API_V1_PREFIX } from './config';
import { getMetrics } from './middleware/metrics';
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

app.use(cors());
app.use(correlationId);
app.use(securityHeaders);
app.use(responseTime);
// Configure Express body parser with JSON payload size limit
// Returns 413 Payload Too Large if exceeded
app.use(express.json({ limit: config.bodyLimit.json }));
app.use(requestLogger);

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

app.get('/ready', async (_req, res) => {
  const services: Record<string, 'ok' | 'unavailable' | 'disabled'> = {};

  // Check IPFS/Pinata availability
  try {
    await checkHealth();
    services.ipfs = 'ok';
  } catch {
    services.ipfs = 'unavailable';
  }

  // Check Stellar RPC if enabled
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

  // Check database — a locked or corrupted DB causes 503
  const dbStatus = await probeDb();
  services.db = dbStatus === 'ok' ? 'ok' : 'unavailable';

  const allOk = Object.values(services).every(v => v === 'ok' || v === 'disabled');
  if (allOk) {
    res.json({ status: 'ok', services });
  } else {
    res.status(503).json({ status: 'degraded', services });
  }
});

// Kubernetes-style liveness and readiness probes
app.get('/health/liveness', (_req, res) => {
  // Liveness checks only that the process is up
  res.json({ status: 'ok' });
});

app.get('/health/readiness', async (_req, res) => {
  const services: Record<string, 'ok' | 'unavailable' | 'disabled'> = {};

  // Check IPFS/Pinata availability
  try {
    await checkHealth();
    services.ipfs = 'ok';
  } catch {
    services.ipfs = 'unavailable';
  }

  // Check Stellar RPC if enabled
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

  // Check database — a locked or corrupted DB causes 503
  const dbStatus = await probeDb();
  services.db = dbStatus === 'ok' ? 'ok' : 'unavailable';

  const allOk = Object.values(services).every(v => v === 'ok' || v === 'disabled');
  if (allOk) {
    res.json({ status: 'ok', services });
  } else {
    res.status(503).json({ status: 'degraded', services });
  }
});

app.get('/metrics', (_req, res) => {
  const routes = getMetrics();
  const lines: string[] = [];

  lines.push('# HELP http_requests_total Total request count per route');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, m] of Object.entries(routes)) {
    lines.push(`http_requests_total{route="${key}"} ${m.count}`);
  }

  lines.push('# HELP http_request_duration_ms_total Accumulated request latency per route');
  lines.push('# TYPE http_request_duration_ms_total counter');
  for (const [key, m] of Object.entries(routes)) {
    lines.push(`http_request_duration_ms_total{route="${key}"} ${m.totalLatencyMs}`);
  }

  lines.push('# HELP indexer_ledger_lag Ledgers behind the chain tip after the last poll');
  lines.push('# TYPE indexer_ledger_lag gauge');
  lines.push(`indexer_ledger_lag ${indexerLedgerLag}`);

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

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
