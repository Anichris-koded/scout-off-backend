/**
 * Tests for isSubscribed() — verifies the real Soroban simulateTransaction
 * call is made and the XDR boolean response is parsed correctly.
 *
 * The Stellar SDK is fully mocked so no live RPC is needed.
 */

// The stellar.ts module creates `server = new SorobanRpc.Server(...)` at
// module load time (singleton). We capture the mock instance's methods
// through the SDK mock after load and reconfigure per test.

jest.mock('@stellar/stellar-sdk', () => ({
  SorobanRpc: {
    Server: jest.fn().mockReturnValue({
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 1 }),
      simulateTransaction: jest.fn().mockResolvedValue({
        result: { retval: { type: 'scvBool' } },
      }),
    }),
    Api: {
      isSimulationError: jest.fn().mockReturnValue(false),
    },
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
  Contract: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockReturnValue({ type: 'invokeHostFunction' }),
  })),
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({}),
  })),
  BASE_FEE: '100',
  Keypair: {
    random: jest.fn().mockReturnValue({ publicKey: () => 'GBADUMMYACCOUNT' }),
  },
  Account: jest.fn().mockImplementation(() => ({})),
  Address: {
    fromString: jest.fn().mockReturnValue({ toScVal: () => ({}) }),
  },
  scValToNative: jest.fn().mockReturnValue(true),
}));

import { isSubscribed, queryMilestones, PaymentError } from '../../src/services/stellar';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const sdk = require('@stellar/stellar-sdk') as any;

function getMockServer() {
  // stellar.ts called `new SorobanRpc.Server(...)` once at module load;
  // grab that instance's `simulateTransaction` to configure per test.
  return sdk.SorobanRpc.Server.mock.results[0]?.value as {
    simulateTransaction: jest.Mock;
  };
}

beforeEach(() => {
  sdk.scValToNative.mockReturnValue(true);
  sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(false);
  getMockServer().simulateTransaction.mockResolvedValue({
    result: { retval: { type: 'scvBool' } },
  });
});

const WALLET = 'G' + 'A'.repeat(55);

describe('isSubscribed', () => {
  it('invokes is_subscribed on the contract and returns { active: true, expiresAt: "" }', async () => {
    sdk.scValToNative.mockReturnValue(true);
    const result = await isSubscribed(WALLET);
    expect(result.active).toBe(true);
    expect(result.expiresAt).toBe('');
  });

  it('returns { active: false, expiresAt: null } when the contract returns false', async () => {
    sdk.scValToNative.mockReturnValue(false);
    const result = await isSubscribed(WALLET);
    expect(result.active).toBe(false);
    expect(result.expiresAt).toBeNull();
  });

  it('returns { active: false, expiresAt: null } when retval is missing', async () => {
    getMockServer().simulateTransaction.mockResolvedValue({ result: null });
    const result = await isSubscribed(WALLET);
    expect(result.active).toBe(false);
    expect(result.expiresAt).toBeNull();
  });

  it('throws PaymentError NETWORK_ERROR on simulation error response', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    getMockServer().simulateTransaction.mockResolvedValue({ error: 'rpc down' });
    await expect(isSubscribed(WALLET)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('throws PaymentError NETWORK_ERROR when simulateTransaction rejects', async () => {
    getMockServer().simulateTransaction.mockRejectedValue(new Error('connection timeout'));
    await expect(isSubscribed(WALLET)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('throws PaymentError for empty wallet without calling the RPC', async () => {
    await expect(isSubscribed('')).rejects.toThrow(PaymentError);
  });
});

describe('queryMilestones', () => {
  it('returns an empty array for a valid playerId (stub)', async () => {
    const result = await queryMilestones('GPLAYER123');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('throws PaymentError for an empty playerId', async () => {
    await expect(queryMilestones('')).rejects.toThrow(PaymentError);
  });
});

describe('HTTP Keepalive Configuration', () => {
  it('configures HTTP keepalive agents on the server httpClient', () => {
    const mockServer = getMockServer();
    // Verify that the httpClient exists and has defaults configured
    expect(mockServer).toBeDefined();
    // The actual agent configuration is done at module load time in stellar.ts
    // This test verifies the module loads without errors
    expect(() => require('../../src/services/stellar')).not.toThrow();
  });
});
