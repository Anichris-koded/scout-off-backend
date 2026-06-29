import request from 'supertest';
import app from '../../src/app';
import { Keypair, Transaction, Networks } from '@stellar/stellar-sdk';

async function getAdminToken(): Promise<string> {
  const kp = Keypair.random();
  const challengeRes = await request(app).get(`/auth/challenge?account=${kp.publicKey()}`);
  const tx = new Transaction(challengeRes.body.challenge, Networks.TESTNET);
  tx.sign(kp);
  const tokenRes = await request(app)
    .post('/auth/token')
    .send({ transaction: tx.toXDR(), role: 'admin' });
  return tokenRes.body.token;
}

describe('GET /api/admin/events - pagination', () => {
  it('returns pagination metadata with defaults', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/admin/events')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.limit).toBe(20);
    expect(res.body.offset).toBe(0);
  });

  it('respects limit and offset params', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/admin/events?limit=5&offset=0')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(0);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('returns 400 for limit exceeding max (100)', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/admin/events?limit=200')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for negative offset', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/admin/events?offset=-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for non-numeric limit', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/admin/events?limit=abc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
