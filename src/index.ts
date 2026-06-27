import { initTracing } from './tracing';
initTracing();

import app from './app';
import config from './config';
import { logger } from './utils/logger';
import { initDb } from './db';
import { stellarHealth } from './services/stellar';
import { checkHealth } from './services/ipfs';
import { indexEvents } from './services/indexer';

initDb();

app.listen(config.port, () => {
  logger.info(`ScoutOff backend running on port ${config.port} [${config.network}]`);

  // Log startup health of critical dependencies
  (async () => {
    const statuses: Record<string, string> = {};
    try {
      await checkHealth();
      statuses.ipfs = 'ok';
    } catch {
      statuses.ipfs = 'unavailable';
    }

    if (config.stellarHealthCheckEnabled) {
      try {
        const sOk = await stellarHealth();
        statuses.stellar = sOk ? 'ok' : 'unavailable';
      } catch {
        statuses.stellar = 'unavailable';
      }
    } else {
      statuses.stellar = 'disabled';
    }

    logger.info(`Startup health: ${JSON.stringify(statuses)}`);
  })();

  // Poll for new contract events every 5 seconds
  const poll = async () => {
    try {
      await indexEvents();
    } catch (err) {
      logger.error('Indexer error:', (err as Error).message);
    }
  };

  poll();
  setInterval(poll, 5_000);
});
