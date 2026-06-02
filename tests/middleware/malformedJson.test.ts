import request from 'supertest';
import app from '../../src/app';

describe('Malformed JSON body guarding', () => {
  it('returns 400 and correlationId for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/players/register')
      .set('Content-Type', 'application/json')
      .set('x-correlation-id', 'test-malformed-id')
      .send('{"invalid": json'); // Sending raw malformed string

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Malformed JSON payload');
    expect(res.body.correlationId).toBe('test-malformed-id');
  });

  it('returns 400 for valid JSON that fails validation (Zod) and includes correlationId', async () => {
    const res = await request(app)
      .post('/api/players/register')
      .set('x-correlation-id', 'test-zod-id')
      .send({ wallet: 'too-short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.correlationId).toBe('test-zod-id');
  });
});
