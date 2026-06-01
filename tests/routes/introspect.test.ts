import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/index';
import { Keypair, Transaction, Networks } from '@stellar/stellar-sdk';

const SECRET = process.env.JWT_SECRET ?? 'test-secret';

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

describe('POST /api/admin/introspect', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).post('/api/admin/introspect').send({ token: 'x' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const kp = Keypair.random();
    const challengeRes = await request(app).get(`/auth/challenge?account=${kp.publicKey()}`);
    const tx = new Transaction(challengeRes.body.challenge, Networks.TESTNET);
    tx.sign(kp);
    const tokenRes = await request(app)
      .post('/auth/token')
      .send({ transaction: tx.toXDR(), role: 'scout' });
    const scoutToken = tokenRes.body.token;

    const res = await request(app)
      .post('/api/admin/introspect')
      .set('Authorization', `Bearer ${scoutToken}`)
      .send({ token: scoutToken });
    expect(res.status).toBe(403);
  });

  it('returns 400 when token body field is missing', async () => {
    const adminToken = await getAdminToken();
    const res = await request(app)
      .post('/api/admin/introspect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an invalid token', async () => {
    const adminToken = await getAdminToken();
    const res = await request(app)
      .post('/api/admin/introspect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: 'not.a.valid.jwt' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns payload metadata for a valid token', async () => {
    const adminToken = await getAdminToken();
    const targetToken = jwt.sign({ sub: 'GTEST', role: 'player' }, SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .post('/api/admin/introspect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: targetToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sub).toBe('GTEST');
    expect(res.body.data.role).toBe('player');
    expect(res.body.data.iat).toBeDefined();
    expect(res.body.data.exp).toBeDefined();
  });
});
