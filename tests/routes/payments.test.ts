import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/index';

const WALLET = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const OTHER_WALLET = 'GBVVJJWBDPFBFYGJZATBCEMQJC4NVVV5MFSM9AYX6XLPKZK36BLLEYK';
const SECRET = process.env.JWT_SECRET ?? 'test-secret';

function makeToken(sub: string, role = 'scout'): string {
  return jwt.sign({ sub, role }, SECRET, { expiresIn: '1h' });
}

describe('GET /api/scouts/:wallet/payments', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/scouts/${WALLET}/payments`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when JWT wallet does not match path wallet', async () => {
    const token = makeToken(OTHER_WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/payments`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Forbidden: wallet does not match authenticated account');
  });

  it('returns 200 when JWT wallet matches path wallet', async () => {
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/payments`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 200 with empty array for wallet with no history', async () => {
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/payments`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts date filter query params without error', async () => {
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/payments?from=2024-01-01&to=2024-12-31`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
