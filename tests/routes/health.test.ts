/**
 * Tests for the readiness probe endpoints (/ready and /health/readiness).
 * Both delegates to the shared checkReadiness() helper, so they must return
 * identical responses for the same service states.
 */

jest.mock('../../src/services/ipfs', () => ({
  pinJson: jest.fn(),
  pinFile: jest.fn(),
  gatewayUrl: jest.fn((cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`),
  checkHealth: jest.fn(),
}));

import request from 'supertest';
import app from '../../src/app';
import * as ipfsService from '../../src/services/ipfs';

const mockCheckHealth = ipfsService.checkHealth as jest.Mock;

const READINESS_PATHS = ['/ready', '/health/readiness'];

describe.each(READINESS_PATHS)('%s', (path) => {
  afterEach(() => {
    mockCheckHealth.mockReset();
  });

  it('returns 200 with ipfs:ok when IPFS is reachable', async () => {
    mockCheckHealth.mockResolvedValueOnce(undefined);
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.ipfs).toBe('ok');
  });

  it('returns 503 with ipfs:unavailable when IPFS is unreachable', async () => {
    mockCheckHealth.mockRejectedValueOnce(new Error('IPFS connection refused'));
    const res = await request(app).get(path);
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.ipfs).toBe('unavailable');
  });
});

describe('GET /ready and GET /health/readiness return identical responses', () => {
  it('both return ok when IPFS is healthy', async () => {
    mockCheckHealth.mockResolvedValue(undefined);
    const [a, b] = await Promise.all([
      request(app).get('/ready'),
      request(app).get('/health/readiness'),
    ]);
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
  });

  it('both return degraded when IPFS is down', async () => {
    mockCheckHealth.mockRejectedValue(new Error('down'));
    const [a, b] = await Promise.all([
      request(app).get('/ready'),
      request(app).get('/health/readiness'),
    ]);
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
  });
});
