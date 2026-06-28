// IPFS service via Pinata.
//
// When PINATA_API_KEY and PINATA_SECRET are not set:
//   - In non-production environments the service starts normally and pin operations
//     return deterministic stub values, logging a warning on each call.
//   - In production (NODE_ENV=production) pin operations throw immediately with a
//     clear error so misconfiguration is caught at call time rather than silently.
//
// IPFS failure handling (#346):
//   - Failures emit a CRITICAL log entry.
//   - The JSON payload is queued in the pending_pins SQLite table for async retry.
//
// Service dependency: Pinata (https://pinata.cloud)
//   Required env vars: PINATA_API_KEY, PINATA_SECRET
//   Optional env var:  PINATA_GATEWAY (default: https://gateway.pinata.cloud)

import axios from 'axios';
import FormData from 'form-data';
import config from '../config';
import { logger } from '../utils/logger';
import { insertPendingPin, getPendingPins, deletePendingPin, incrementPendingPinAttempts } from '../db';

const PINATA_PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PINATA_PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_TEST_URL     = 'https://api.pinata.cloud/data/testAuthentication';

function isPinataConfigured(): boolean {
  return !!(config.pinata.apiKey && config.pinata.secret);
}

function assertPinataConfigured(): void {
  throw new Error(
    'IPFS service unavailable: PINATA_API_KEY and PINATA_SECRET must be set in production'
  );
}

function pinataHeaders() {
  return {
    pinata_api_key: config.pinata.apiKey,
    pinata_secret_api_key: config.pinata.secret,
  };
}

function devStubCid(seed: string): string {
  const n = seed.length + (seed.charCodeAt(0) || 0);
  return `bafymock${n}`;
}

/** Pin a JSON object to IPFS via Pinata. Returns the CID. */
export async function pinJson(body: object): Promise<string> {
  if (!isPinataConfigured()) {
    if (process.env.NODE_ENV === 'production') assertPinataConfigured();
    logger.warn('[ipfs] Pinata not configured — returning dev stub CID for pinJson');
    return devStubCid(JSON.stringify(body));
  }
  try {
    const res = await axios.post(PINATA_PIN_JSON_URL, body, { headers: pinataHeaders() });
    return res.data.IpfsHash as string;
  } catch (err) {
    logger.critical('[ipfs] Pinata unavailable — queueing payload for retry', (err as Error).message);
    insertPendingPin(body);
    throw err;
  }
}

/** Pin a file buffer to IPFS via Pinata. Returns the CID. */
export async function pinFile(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  if (!isPinataConfigured()) {
    if (process.env.NODE_ENV === 'production') assertPinataConfigured();
    logger.warn('[ipfs] Pinata not configured — returning dev stub CID for pinFile');
    return devStubCid(filename);
  }
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: mimeType });
  const res = await axios.post(PINATA_PIN_FILE_URL, form, {
    headers: { ...pinataHeaders(), ...form.getHeaders() },
    maxBodyLength: Infinity,
  });
  return res.data.IpfsHash as string;
}

/** Build a public gateway URL for a CID. */
export function gatewayUrl(cid: string): string {
  return `${config.pinata.gateway}/ipfs/${cid}`;
}

/** Build all public gateway URLs for a CID, in priority order. */
export function gatewayUrls(cid: string): string[] {
  return config.pinata.gateways.map(gateway => `${gateway}/ipfs/${cid}`);
}

/** Strip ipfs:// prefix from a URI, or return the input unchanged. */
export async function getCid(uriOrCid: string): Promise<string> {
  return uriOrCid.startsWith('ipfs://') ? uriOrCid.replace('ipfs://', '') : uriOrCid;
}

/**
 * Health check for the Pinata/IPFS dependency.
 * Resolves immediately (with a warning) when credentials are absent in non-production.
 * Rejects with a clear error in production without credentials.
 */
export async function checkHealth(): Promise<void> {
  if (!isPinataConfigured()) {
    if (process.env.NODE_ENV === 'production') assertPinataConfigured();
    logger.warn('[ipfs] Pinata not configured — skipping IPFS health check in dev');
    return;
  }
  await axios.get(PINATA_TEST_URL, { headers: pinataHeaders() });
}

/**
 * Retry queued pending_pins entries. Called periodically when IPFS recovers.
 * Successfully pinned entries are removed from the queue.
 */
export async function retryPendingPins(): Promise<void> {
  if (!isPinataConfigured()) return;
  const pending = getPendingPins();
  for (const row of pending) {
    try {
      const body = JSON.parse(row.payload) as object;
      const res = await axios.post(PINATA_PIN_JSON_URL, body, { headers: pinataHeaders() });
      logger.info(`[ipfs] retried pending pin id=${row.id} cid=${res.data.IpfsHash as string}`);
      deletePendingPin(row.id);
    } catch {
      incrementPendingPinAttempts(row.id);
    }
  }
}

export default { pinJson, pinFile, gatewayUrl, getCid, checkHealth, retryPendingPins };
