import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

const config = {
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
  securityHeaders: {
    hsts: process.env.SECURITY_HSTS ?? 'max-age=31536000; includeSubDomains',
    xContentTypeOptions: process.env.SECURITY_X_CONTENT_TYPE_OPTIONS ?? 'nosniff',
    xFrameOptions: process.env.SECURITY_X_FRAME_OPTIONS ?? 'DENY',
    referrerPolicy: process.env.SECURITY_REFERRER_POLICY ?? 'no-referrer',
  },
};

export default config;
