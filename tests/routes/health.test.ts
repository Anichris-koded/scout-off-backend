/**
 * Tests for the /health and /ready health check endpoints.
 * External services (IPFS, Stellar) are stubbed so no real network calls are made.
 * The DB module is partially mocked to exercise the DB probe logic.
 */

// Stub IPFS before app is imported.
jest.mock('../../src/services/ipfs', () => ({
  pinJson: jest.fn(),
  pinFile: jest.fn(),
  gatewayUrl: jest.fn((cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`),
  checkHealth: jest.fn(),
}));

// Partially mock the db module so individual tests can control getDb().
jest.mock('../../src/db', () => {
  const actual = jest.requireActual<typeof import('../../src/db')>('../../src/db');
  return { ...actual, getDb: jest.fn(actual.getDb) };
});

import request from 'supertest';
import app from '../../src/app';
import * as ipfsService from '../../src/services/ipfs';
import * as dbModule from '../../src/db';

const mockCheckHealth = ipfsService.checkHealth as jest.Mock;
const mockGetDb = dbModule.getDb as jest.Mock;

// ─── /ready ──────────────────────────────────────────────────────────────────

describe('GET /ready', () => {
  afterEach(() => {
    mockCheckHealth.mockReset();
    mockGetDb.mockReset();
    // Restore to the real implementation between tests
    mockGetDb.mockImplementation(
      jest.requireActual<typeof import('../../src/db')>('../../src/db').getDb,
    );
  });

  it('returns 200 and includes db:ok when all dependencies are healthy', async () => {
    mockCheckHealth.mockResolvedValueOnce(undefined);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.ipfs).toBe('ok');
    expect(res.body.services.db).toBe('ok');
  });

  it('includes db field in the services object', async () => {
    mockCheckHealth.mockResolvedValueOnce(undefined);
    const res = await request(app).get('/ready');
    expect(res.body.services).toHaveProperty('db');
    expect(['ok', 'unavailable']).toContain(res.body.services.db);
  });

  it('returns 503 with ipfs:unavailable when IPFS is unreachable', async () => {
    mockCheckHealth.mockRejectedValueOnce(new Error('IPFS connection refused'));
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.ipfs).toBe('unavailable');
  });

  it('returns 503 with db:unavailable when the database probe throws', async () => {
    mockCheckHealth.mockResolvedValueOnce(undefined);
    // Simulate a locked or corrupted DB
    mockGetDb.mockImplementation(() => {
      throw new Error('SQLITE_BUSY: database is locked');
    });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.db).toBe('unavailable');
  });
});

// ─── /health ─────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  afterEach(() => {
    mockGetDb.mockReset();
    mockGetDb.mockImplementation(
      jest.requireActual<typeof import('../../src/db')>('../../src/db').getDb,
    );
  });

  it('returns 200 and includes db field in healthStatus', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.healthStatus).toHaveProperty('db');
    expect(['ok', 'error']).toContain(res.body.healthStatus.db);
  });

  it('includes db:ok when the database is reachable', async () => {
    const res = await request(app).get('/health');
    expect(res.body.healthStatus.db).toBe('ok');
  });

  it('reports db:error in healthStatus but still returns 200 when the DB probe fails', async () => {
    // /health is a liveness probe — it always returns 200.
    // A DB failure is surfaced in healthStatus.db without changing the HTTP status.
    mockGetDb.mockImplementation(() => {
      throw new Error('SQLITE_BUSY: database is locked');
    });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.healthStatus.db).toBe('error');
  });
});
