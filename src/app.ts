import express from 'express';
import cors from 'cors';
import config from './config';
import authRoutes from './routes/auth';
import playerRoutes from './routes/player';
import scoutRoutes from './routes/scout';
import validatorRoutes from './routes/validator';
import adminRoutes from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { securityHeaders } from './middleware/securityHeaders';
import { correlationId } from './middleware/correlationId';
import { responseTime } from './middleware/responseTime';
import { stellarHealth } from './services/stellar';
import { checkHealth } from './services/ipfs';

const app = express();

app.use(cors());
app.use(correlationId);
app.use(securityHeaders);
app.use(responseTime);
app.use(express.json());

app.get('/health', async (_req, res) => {
  const healthStatus: Record<string, 'ok' | 'error' | 'disabled'> = {};

  if (config.stellarHealthCheckEnabled) {
    const stellarOk = await stellarHealth();
    healthStatus.stellar = stellarOk ? 'ok' : 'error';
  } else {
    healthStatus.stellar = 'disabled';
  }

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

  const allOk = Object.values(services).every(v => v === 'ok' || v === 'disabled');
  if (allOk) {
    res.json({ status: 'ok', services });
  } else {
    res.status(503).json({ status: 'degraded', services });
  }
});

app.use('/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/scouts', scoutRoutes);
app.use('/api/validators', validatorRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

export default app;
