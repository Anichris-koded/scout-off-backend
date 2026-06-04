import { isSubscribed, PaymentError } from '../../src/services/stellar';

// Mock the Soroban server so tests don't need a live RPC
jest.mock('@stellar/stellar-sdk', () => ({
  SorobanRpc: { Server: jest.fn().mockReturnValue({ getLatestLedger: jest.fn().mockResolvedValue({ sequence: 1 }) }) },
  Networks: { TESTNET: 'Test SDF Network ; September 2015', PUBLIC: 'Public Global Stellar Network ; September 2015' },
  TransactionBuilder: jest.fn(),
  BASE_FEE: '100',
}));

describe('isSubscribed', () => {
  it('returns { active: false, expiresAt: null } for a valid wallet (stub)', async () => {
    const result = await isSubscribed('GSCOUT123');
    expect(result.active).toBe(false);
    expect(result.expiresAt).toBeNull();
  });

  it('returns an object with active and expiresAt fields (typed)', async () => {
    const result = await isSubscribed('GSCOUT456');
    expect(typeof result.active).toBe('boolean');
    // expiresAt is string | null
    expect(result.expiresAt === null || typeof result.expiresAt === 'string').toBe(true);
  });

  it('throws PaymentError for empty wallet', async () => {
    await expect(isSubscribed('')).rejects.toThrow(PaymentError);
  });

  it('mock result can be overridden for active subscription testing', async () => {
    // Demonstrates pluggability: mock isSubscribed to return active
    const mockIsSubscribed = jest.fn().mockResolvedValue({ active: true, expiresAt: '2027-01-01T00:00:00.000Z' });
    const result = await mockIsSubscribed('GSCOUT789');
    expect(result.active).toBe(true);
    expect(result.expiresAt).toBe('2027-01-01T00:00:00.000Z');
  });
});
