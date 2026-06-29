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

  it('supports multiple allowlisted origins', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://app.scoutoff.io,https://staging.scoutoff.io';

    const { default: app } = await import('../../src/app');
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://staging.scoutoff.io');
    expect(res.headers['access-control-allow-origin']).toBe('https://staging.scoutoff.io');
  });

  it('returns CORS headers on preflight OPTIONS request for allowed origin', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = ALLOWED;

    const { default: app } = await import('../../src/app');
    const res = await request(app)
      .options('/health')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('omits CORS header on preflight OPTIONS for disallowed origin', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = ALLOWED;

    const { default: app } = await import('../../src/app');
    const res = await request(app)
      .options('/health')
      .set('Origin', 'https://attacker.example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
