// IPFS service (stub)
// Provides simple deterministic stubs for pinning JSON and retrieving CIDs.
//
// Pinata integration notes:
// - To integrate with Pinata, set PINATA_API_KEY and PINATA_SECRET_API_KEY in env.
// - Use Pinata's /pinning/pinJSONToIPFS endpoint with a POST containing the JSON body.
// - Optionally include metadata and options (pinPolicy) as described in Pinata docs.
// - For production, add retries, content-address verification, and monitor pin status.

export async function pinJson(obj: unknown): Promise<{ cid: string }>{
  // Deterministic placeholder CID for tests.
  // Replace with Pinata HTTP call when enabling real integration.
  const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
  // Simple stable hash-like mock using string length and char codes.
  const seed = String(jsonStr.length + (jsonStr.charCodeAt(0) || 0));
  const cid = `bafymock${seed}`;
  return { cid };
}

export async function getCid(uriOrCid: string): Promise<string>{
  // If an IPFS URI is provided like ipfs://<cid>, strip the prefix.
  if (uriOrCid.startsWith('ipfs://')) return uriOrCid.replace('ipfs://','');
  // Return the input for deterministic behavior in tests.
  return uriOrCid;
}

export default { pinJson, getCid };
import axios from 'axios';
import FormData from 'form-data';
import config from '../config';

const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PINATA_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_TEST_URL = 'https://api.pinata.cloud/data/testAuthentication';

function headers() {
  return {
    pinata_api_key: config.pinata.apiKey,
    pinata_secret_api_key: config.pinata.secret,
  };
}

/** Pin a JSON object to IPFS via Pinata. Returns the CID. */
export async function pinJson(body: object): Promise<string> {
  const res = await axios.post(PINATA_PIN_URL, body, { headers: headers() });
  return res.data.IpfsHash as string;
}

/** Pin a file buffer to IPFS via Pinata. Returns the CID. */
export async function pinFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: mimeType });
  const res = await axios.post(PINATA_FILE_URL, form, {
    headers: { ...headers(), ...form.getHeaders() },
    maxBodyLength: Infinity,
  });
  return res.data.IpfsHash as string;
}

/** Build a public gateway URL for a CID. */
export function gatewayUrl(cid: string): string {
  return `${config.pinata.gateway}/ipfs/${cid}`;
}

/**
 * Health check for the IPFS/Pinata service dependency.
 * Calls the Pinata authentication test endpoint to confirm connectivity.
 * Resolves on success; rejects with an error if the service is unreachable
 * or returns a non-2xx status.
 *
 * Stub this function in tests to avoid real network calls.
 */
export async function checkHealth(): Promise<void> {
  await axios.get(PINATA_TEST_URL, { headers: headers() });
}
