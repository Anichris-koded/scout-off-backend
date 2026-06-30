import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';

const SECRET = process.env.JWT_SECRET ?? 'test-secret';

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
    const token = jwt.sign({ sub: 'G' + 'A'.repeat(55), role: 'player' }, SECRET, { expiresIn: '1h' });
    const res = await request(app)
      .post('/api/players/register')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', 'test-zod-id')
      .send({ wallet: 'too-short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.correlationId).toBe('test-zod-id');
  });
});
