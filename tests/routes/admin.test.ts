import request from 'supertest';
import app from '../../src/app';
import { Keypair, Transaction, Networks } from '@stellar/stellar-sdk';

async function getToken(role: string): Promise<string> {
  const kp = Keypair.random();
  const challengeRes = await request(app).get(`/auth/challenge?account=${kp.publicKey()}`);
  const tx = new Transaction(challengeRes.body.challenge, Networks.TESTNET);
  tx.sign(kp);
  const tokenRes = await request(app)
    .post('/auth/token')
    .send({ transaction: tx.toXDR(), role });
  return tokenRes.body.token;
}

const VALID_WALLET = Keypair.random().publicKey();

// ─── Security headers ─────────────────────────────────────────────────────────

describe('Security headers', () => {
  it('sets required security headers on all responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  it('sets helmet cross-origin headers on all responses', async () => {
    const res = await request(app).get('/health');
    // Helmet-provided headers absent from the custom middleware
    expect(res.headers['cross-origin-opener-policy']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBeDefined();
    expect(res.headers['x-permitted-cross-domain-policies']).toBeDefined();
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });

  it('does not expose x-powered-by header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ─── Admin validator registry ─────────────────────────────────────────────────

describe('POST /api/admin/validators/register', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/admin/validators/register')
      .send({ validatorWallet: VALID_WALLET });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const token = await getToken('validator');
    const res = await request(app)
      .post('/api/admin/validators/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ validatorWallet: VALID_WALLET });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid wallet address', async () => {
    const token = await getToken('admin');
    const res = await request(app)
      .post('/api/admin/validators/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ validatorWallet: 'NOTAVALIDADDRESS' });
    expect(res.status).toBe(400);
  });

  it('returns 202 for valid admin request', async () => {
    const token = await getToken('admin');
    const res = await request(app)
      .post('/api/admin/validators/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ validatorWallet: VALID_WALLET });
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/admin/validators/revoke', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/admin/validators/revoke')
      .send({ validatorWallet: VALID_WALLET });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const token = await getToken('scout');
    const res = await request(app)
      .post('/api/admin/validators/revoke')
      .set('Authorization', `Bearer ${token}`)
      .send({ validatorWallet: VALID_WALLET });
    expect(res.status).toBe(403);
  });

  it('returns 202 for valid admin request', async () => {
    const token = await getToken('admin');
    const res = await request(app)
      .post('/api/admin/validators/revoke')
      .set('Authorization', `Bearer ${token}`)
      .send({ validatorWallet: VALID_WALLET });
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/admin/validators', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/admin/validators');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const token = await getToken('scout');
    const res = await request(app)
      .get('/api/admin/validators')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with a data array for admin', async () => {
    const token = await getToken('admin');
    const res = await request(app)
      .get('/api/admin/validators')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('includes a registered validator after registration', async () => {
    const token = await getToken('admin');
    // Register first
    await request(app)
      .post('/api/admin/validators/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ validatorWallet: VALID_WALLET });
    // Then list
    const res = await request(app)
      .get('/api/admin/validators')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.data.find((v: { wallet: string }) => v.wallet === VALID_WALLET);
    expect(found).toBeDefined();
    expect(found.registered_at).toBeGreaterThan(0);
    expect(found.revoked_at).toBeNull();
  });

  it('marks a validator as revoked after revocation', async () => {
    const token = await getToken('admin');
    // Register then revoke
    await request(app)
      .post('/api/admin/validators/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ validatorWallet: VALID_WALLET });
    await request(app)
      .post('/api/admin/validators/revoke')
      .set('Authorization', `Bearer ${token}`)
      .send({ validatorWallet: VALID_WALLET });
    const res = await request(app)
      .get('/api/admin/validators')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.data.find((v: { wallet: string }) => v.wallet === VALID_WALLET);
    expect(found).toBeDefined();
    expect(found.revoked_at).not.toBeNull();
  });
});
