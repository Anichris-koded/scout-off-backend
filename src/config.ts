import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

const ConfigSchema = z.object({
  port: z.coerce.number().default(4000),
  network: z.enum(['testnet', 'mainnet']).default('testnet'),
  networkPassphrase: z.string().default('Test SDF Network ; September 2015'),
  horizonUrl: z.string().url().default('https://horizon-testnet.stellar.org'),
  sorobanRpcUrl: z.string().url().default('https://soroban-testnet.stellar.org'),
  contractId: z.string().min(1),
  jwtSecret: z.string().min(1),
  pinata: z.object({
    apiKey: z.string().default(''),
    secret: z.string().default(''),
    gateway: z.string().url().default('https://gateway.pinata.cloud'),
  }),
  platformFeeBps: z.coerce.number().default(500),
  dbPath: z.string().default('scout-off.db'),
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

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
};

export default config;

/** Route prefix constants for API versioning */
export const API_PREFIX = process.env.API_PREFIX ?? '/api';
export const API_V1_PREFIX = process.env.API_V1_PREFIX ?? '/api/v1';
