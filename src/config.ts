import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type NodeEnv = 'development' | 'test' | 'staging' | 'production';

const VALID_ENVS: ReadonlySet<string> = new Set(['development', 'test', 'staging', 'production']);

const rawNodeEnv = process.env.NODE_ENV ?? 'development';
if (!VALID_ENVS.has(rawNodeEnv)) {
  throw new Error(`Invalid NODE_ENV: "${rawNodeEnv}". Must be one of: ${[...VALID_ENVS].join(', ')}`);
}
const nodeEnv = rawNodeEnv as NodeEnv;

const ENV_LOG_LEVEL: Record<NodeEnv, LogLevel> = {
  development: 'debug',
  test: 'warn',
  staging: 'info',
  production: 'warn',
};

const config = {
  nodeEnv,
  port: parseInt(process.env.PORT ?? '4000', 10),
  network: (process.env.NETWORK ?? 'testnet') as 'testnet' | 'mainnet',
  networkPassphrase:
    process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
  horizonUrl:
    process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl:
    process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  contractId: required('CONTRACT_ID'),
  jwtSecret: required('JWT_SECRET'),
  pinata: {
    apiKey: process.env.PINATA_API_KEY ?? '',
    secret: process.env.PINATA_SECRET ?? '',
    gateway: process.env.PINATA_GATEWAY ?? 'https://gateway.pinata.cloud',
  },
  platformFeeBps: parseInt(process.env.PLATFORM_FEE_BPS ?? '500', 10),
  dbPath: process.env.DB_PATH ?? 'scout-off.db',
  stellarHealthCheckEnabled: process.env.STELLAR_HEALTH_CHECK !== 'false',
  adminWallet: process.env.ADMIN_WALLET ?? '',
  securityHeaders: {
    hsts: process.env.SECURITY_HSTS ?? 'max-age=31536000; includeSubDomains',
    xContentTypeOptions: process.env.SECURITY_X_CONTENT_TYPE_OPTIONS ?? 'nosniff',
    xFrameOptions: process.env.SECURITY_X_FRAME_OPTIONS ?? 'DENY',
    referrerPolicy: process.env.SECURITY_REFERRER_POLICY ?? 'no-referrer',
  },
  webhook: {
    enabled: process.env.WEBHOOK_ENABLED === 'true',
    url: process.env.WEBHOOK_URL ?? '',
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? (process.env.NODE_ENV === 'test' ? '1000' : '60'), 10),
  },
  bodyLimit: {
    // Maximum JSON payload size (default: 1MB)
    json: process.env.JSON_PAYLOAD_LIMIT ?? '1mb',
  },
  logLevel: (process.env.LOG_LEVEL ?? ENV_LOG_LEVEL[nodeEnv]) as LogLevel,
  showErrorDetails: nodeEnv === 'development' || nodeEnv === 'test',
  useMockServices: nodeEnv === 'development' || nodeEnv === 'test',
  backfillFromLedger: process.env.INDEXER_BACKFILL_FROM_LEDGER
    ? parseInt(process.env.INDEXER_BACKFILL_FROM_LEDGER, 10)
    : null,
};

export default config;

export function isProduction(): boolean { return config.nodeEnv === 'production'; }
export function isStaging(): boolean { return config.nodeEnv === 'staging'; }
export function isDevelopment(): boolean { return config.nodeEnv === 'development'; }

/** Route prefix constants for API versioning */
export const API_PREFIX = process.env.API_PREFIX ?? '/api';
export const API_V1_PREFIX = process.env.API_V1_PREFIX ?? '/api/v1';
