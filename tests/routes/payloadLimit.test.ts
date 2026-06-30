import request from 'supertest';
import app from '../../src/app';

describe('JSON Payload Size Limit', () => {
  it('accepts valid payloads within the limit', async () => {
    const validPayload = {
      wallet: 'G'.repeat(56),
      position: 'striker',
      region: 'europe',
      metadataUri: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    };

    const res = await request(app)
      .post('/api/players/register')
      .send(validPayload);

    // Should not return 413
    expect(res.status).not.toBe(413);
  });

  it('returns HTTP 413 when payload exceeds the configured limit', async () => {
    // Create a very large payload that exceeds the 1mb default limit
    const largePayload = {
      data: 'x'.repeat(2 * 1024 * 1024), // 2MB of data
    };

    const res = await request(app)
      .post('/api/players/register')
      .send(largePayload);

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Payload too large');
  });

  it('error response includes appropriate message for oversized payloads', async () => {
    const largePayload = {
      data: 'x'.repeat(2 * 1024 * 1024), // 2MB of data
    };

    const res = await request(app)
      .post('/api/players/register')
      .send(largePayload);

    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });
});
