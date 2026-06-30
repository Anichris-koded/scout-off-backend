import request from 'supertest';
import { Keypair, Transaction, Networks } from '@stellar/stellar-sdk';
import app from '../../src/app';

async function getAuthToken(role: string): Promise<string> {
  const kp = Keypair.random();
  const challengeRes = await request(app).get(`/auth/challenge?account=${kp.publicKey()}`);
  const tx = new Transaction(challengeRes.body.challenge, Networks.TESTNET);
  tx.sign(kp);
  const tokenRes = await request(app)
    .post('/auth/token')
    .send({ transaction: tx.toXDR(), role });
  return tokenRes.body.token;
}

describe('Admin query schema date filtering (#30)', () => {
  let token: string;

  beforeAll(async () => {
    token = await getAuthToken('admin');
  });

  describe('GET /api/admin/events', () => {
    it('returns 200 with no query params', async () => {
      const res = await request(app)
        .get('/api/admin/events')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 200 with valid ISO startDate and endDate', async () => {
      const res = await request(app)
        .get('/api/admin/events')
        .query({ startDate: '2024-01-01T00:00:00.000Z', endDate: '2025-12-31T00:00:00.000Z' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid startDate format', async () => {
      const res = await request(app)
        .get('/api/admin/events')
        .query({ startDate: 'not-a-date' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid endDate format', async () => {
      const res = await request(app)
        .get('/api/admin/events')
        .query({ endDate: '31-12-2024' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when startDate is after endDate', async () => {
      const res = await request(app)
        .get('/api/admin/events')
        .query({ startDate: '2025-12-01T00:00:00.000Z', endDate: '2024-01-01T00:00:00.000Z' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/fees', () => {
    it('returns 200 with no query params', async () => {
      const res = await request(app)
        .get('/api/admin/fees')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid startDate on /fees', async () => {
      const res = await request(app)
        .get('/api/admin/fees')
        .query({ startDate: 'bad-date' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
