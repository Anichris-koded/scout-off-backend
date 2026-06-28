/**
 * Tests for CORS origin allowlist behaviour (issue #270).
 */

jest.mock('../../src/services/ipfs', () => ({
  pinJson: jest.fn(),
  pinFile: jest.fn(),
  gatewayUrl: jest.fn(),
  checkHealth: jest.fn(),
}));

import request from 'supertest';

describe('CORS origin allowlist', () => {
  const ALLOWED = 'https://app.scoutoff.io';

  beforeEach(() => {
    jest.resetModules();
  });

  it('allows requests from an allowlisted origin in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = ALLOWED;

    const { default: app } = await import('../../src/app');
    const res = await request(app).get('/health').set('Origin', ALLOWED);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('blocks requests from a non-allowlisted origin in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = ALLOWED;

    const { default: app } = await import('../../src/app');
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example.com');
    // cors middleware omits the header for disallowed origins
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows wildcard in development without ALLOWED_ORIGINS set', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOWED_ORIGINS;

    const { default: app } = await import('../../src/app');
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://anything.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
