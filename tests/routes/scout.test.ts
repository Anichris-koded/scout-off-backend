import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';

const SECRET = process.env.JWT_SECRET ?? 'test-secret';

jest.mock('../../src/db', () => ({
  getEvents: jest.fn(),
}));

jest.mock('../../src/services/indexer', () => ({
  indexEvents: jest.fn(),
  normalizeEventId: jest.fn(),
}));

jest.mock('../../src/services/stellar', () => ({
  submitContactPayment: jest.fn(),
  purchaseSubscription: jest.fn(),
  isSubscribed: jest.fn().mockResolvedValue({ active: false, expiresAt: null }),
  PaymentError: class PaymentError extends Error {
    constructor(public message: string, public code: string) { super(message); }
  },
}));

import { getEvents } from '../../src/services/indexer';
import { submitContactPayment, purchaseSubscription } from '../../src/services/stellar';
import { getEvents } from '../../src/db';
import { submitContactPayment, isSubscribed, logTrialOffer } from '../../src/services/stellar';
const mockGetEvents = getEvents as jest.Mock;
const mockSubmitContactPayment = submitContactPayment as jest.Mock;
const mockIsSubscribed = isSubscribed as jest.Mock;
const mockLogTrialOffer = logTrialOffer as jest.Mock;

function makeToken(wallet: string, role = 'scout'): string {
  return jwt.sign({ sub: wallet, role }, SECRET, { expiresIn: '1h' });
}

function makePlayerToken(wallet: string): string {
  return makeToken(wallet, 'player');
}
function makeValidatorToken(wallet: string): string {
  return makeToken(wallet, 'validator');
}

const WALLET = 'GSCOUTWALLET1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const OTHER  = 'GOTHERWALLET2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

beforeEach(() => {
  mockGetEvents.mockReset();
  mockIsSubscribed.mockReset().mockResolvedValue({ active: false, expiresAt: null });
});

// ─── GET /api/scouts/:wallet/subscription ─────────────────────────────────────

describe('GET /api/scouts/:wallet/subscription', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/scouts/${WALLET}/subscription`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT wallet does not match path wallet', async () => {
    const token = makeToken(OTHER);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns inactive subscription when no events exist', async () => {
    mockGetEvents.mockReturnValue([]);
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ active: false, tier: null, expiresAt: null, remainingDays: 0 });
  });

  it('returns active subscription with correct fields', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 10; // 10 days from now
    mockGetEvents.mockReturnValue([
      {
        source: 'contract',
        type: 'scout_subscribed',
        contractAddress: 'contract',
        payload: { scout: WALLET, subscription_expiry: expiresAt, tier: 'pro' },
      },
    ]);
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.active).toBe(true);
    expect(res.body.data.tier).toBe('pro');
    expect(res.body.data.expiresAt).toBe(expiresAt);
    expect(res.body.data.remainingDays).toBeGreaterThan(0);
  });

  it('returns expired subscription as inactive with 0 remainingDays', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 86400; // expired yesterday
    mockGetEvents.mockReturnValue([
      {
        source: 'contract',
        type: 'scout_subscribed',
        contractAddress: 'contract',
        payload: { scout: WALLET, subscription_expiry: expiresAt },
      },
    ]);
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
    expect(res.body.data.remainingDays).toBe(0);
  });

  it('defaults tier to "basic" when not present in payload', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;
    mockGetEvents.mockReturnValue([
      {
        source: 'contract',
        type: 'scout_subscribed',
        contractAddress: 'contract',
        payload: { scout: WALLET, subscription_expiry: expiresAt },
      },
    ]);
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBe('basic');
  });
});

// ─── GET /api/scouts/:wallet/contacts ─────────────────────────────────────────

describe('GET /api/scouts/:wallet/contacts', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/scouts/${WALLET}/contacts`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when JWT wallet does not match path wallet', async () => {
    const token = makeToken(OTHER);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/contacts`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns empty array when no contacts exist', async () => {
    mockGetEvents.mockReturnValue([]);
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/contacts`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns contacts with correct shape', async () => {
    const unlockedAt = Math.floor(Date.now() / 1000) - 3600;
    mockGetEvents.mockReturnValue([
      {
        source: 'contract',
        type: 'contact_unlocked',
        contractAddress: 'contract',
        payload: { scout: WALLET, player_id: 'player-42', unlocked_at: unlockedAt },
      },
      {
        source: 'contract',
        type: 'contact_unlocked',
        contractAddress: 'contract',
        payload: { scout: WALLET, player_id: 'player-99', unlocked_at: unlockedAt + 100 },
      },
    ]);
    const token = makeToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/contacts`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({
      playerId: 'player-42',
      contact_status: 'unlocked',
      unlockedAt,
    });
    expect(res.body.data[1].playerId).toBe('player-99');
    expect(res.body.data[1].contact_status).toBe('unlocked');
  });
});

// ─── POST /api/scouts/:wallet/contacts/:playerId/unlock ───────────────────────

describe('POST /api/scouts/:wallet/contacts/:playerId/unlock', () => {
  const PLAYER_ID = 'player-123';

  beforeEach(() => {
    mockGetEvents.mockReset();
    mockSubmitContactPayment.mockReset();
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post(`/api/scouts/${WALLET}/contacts/${PLAYER_ID}/unlock`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when JWT wallet does not match path wallet', async () => {
    const token = makeToken(OTHER);
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/contacts/${PLAYER_ID}/unlock`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/wallet/i);
  });

  it('proceeds with unlock when JWT wallet matches path wallet', async () => {
    mockSubmitContactPayment.mockResolvedValue({ txHash: 'abc123', fee: '1' });
    const token = makeToken(WALLET);
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/contacts/${PLAYER_ID}/unlock`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSubmitContactPayment).toHaveBeenCalledWith(WALLET, PLAYER_ID);
  });
});

// ─── POST /api/scouts/:wallet/subscribe ──────────────────────────────────────

describe('POST /api/scouts/:wallet/subscribe', () => {
  const VALID_BODY = { tier: 'basic', duration: 30 };

  beforeEach(() => {
    mockPurchaseSubscription.mockReset();
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post(`/api/scouts/${WALLET}/subscribe`).send(VALID_BODY);
    expect(res.status).toBe(401);
  });

  it('returns 403 when token role is not scout', async () => {
    const token = makeToken(WALLET, 'player');
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY);
    expect(res.status).toBe(403);
  });

  it('returns 201 with subscription data on success', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 86400;
    mockPurchaseSubscription.mockResolvedValue({
      transactionId: 'tx-abc123',
      tier: 'basic',
      expiresAt,
      status: 'active',
    });
    const token = makeToken(WALLET);
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBe('tx-abc123');
    expect(res.body.data.tier).toBe('basic');
    expect(res.body.data.expiresAt).toBe(expiresAt);
    expect(res.body.data.status).toBe('active');
    expect(mockPurchaseSubscription).toHaveBeenCalledWith(WALLET, 'basic', 30);
  });

  it('returns 400 for invalid tier', async () => {
    const token = makeToken(WALLET);
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tier: 'gold', duration: 30 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for missing duration', async () => {
    const token = makeToken(WALLET);
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tier: 'basic' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for duration out of range', async () => {
    const token = makeToken(WALLET);
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tier: 'basic', duration: 400 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 402 when purchaseSubscription throws INSUFFICIENT_FUNDS', async () => {
    const { PaymentError } = jest.requireMock('../../src/services/stellar');
    mockPurchaseSubscription.mockRejectedValue(new PaymentError('Insufficient XLM balance', 'INSUFFICIENT_FUNDS'));
    const token = makeToken(WALLET);
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY);
    expect(res.status).toBe(402);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
  });
});
// ─── Role enforcement — non-scout JWTs must be rejected ──────────────────────

describe('Scout route role enforcement', () => {
  it('returns 403 when player JWT calls GET subscription', async () => {
    const token = makePlayerToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when validator JWT calls GET subscription', async () => {
    const token = makeValidatorToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when player JWT calls GET contacts', async () => {
    const token = makePlayerToken(WALLET);
    const res = await request(app)
      .get(`/api/scouts/${WALLET}/contacts`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when player JWT calls POST unlock', async () => {
    const token = makePlayerToken(WALLET);
    const res = await request(app)
      .post(`/api/scouts/${WALLET}/contacts/player-1/unlock`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
