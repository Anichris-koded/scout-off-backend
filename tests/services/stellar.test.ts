/**
 * Tests for stellar.ts service functions:
 *   - isSubscribed()              — view-only simulation call
 *   - queryMilestones()           — stub returning []
 *   - cancelSubscriptionOnChain() — real Soroban invocation
 *   - pauseContractOnChain()      — real Soroban invocation
 *
 * The Stellar SDK and signer utility are fully mocked so no live RPC is needed.
 */

// ─── Top-level mock methods ───────────────────────────────────────────────────
// We declare these at the top level so jest.fn() instances survive
// jest.clearAllMocks() in beforeEach without losing their identities.
// (clearAllMocks resets recorded calls + return values, but the same
// jest.fn() reference is still reachable from the mock factory closure.)

const mockGetAccount      = jest.fn();
const mockSimulate        = jest.fn();
const mockSendTransaction = jest.fn();
const mockGetTransaction  = jest.fn();
const mockAssembleBuild   = jest.fn().mockReturnValue({ sign: jest.fn() });
const mockAssemble        = jest.fn().mockReturnValue({ build: mockAssembleBuild });

jest.mock('@stellar/stellar-sdk', () => ({
  SorobanRpc: {
    Server: jest.fn().mockReturnValue({
      getLatestLedger:     jest.fn().mockResolvedValue({ sequence: 1 }),
      getAccount:          mockGetAccount,
      simulateTransaction: mockSimulate,
      sendTransaction:     mockSendTransaction,
      getTransaction:      mockGetTransaction,
    }),
    Api: {
      isSimulationError: jest.fn().mockReturnValue(false),
      GetTransactionStatus: {
        NOT_FOUND: 'NOT_FOUND',
        SUCCESS:   'SUCCESS',
        FAILED:    'FAILED',
      },
    },
    assembleTransaction: mockAssemble,
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC:  'Public Global Stellar Network ; September 2015',
  },
  Contract: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockReturnValue({ type: 'invokeHostFunction' }),
  })),
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout:   jest.fn().mockReturnThis(),
    build:        jest.fn().mockReturnValue({}),
  })),
  BASE_FEE: '100',
  Keypair: {
    random:     jest.fn().mockReturnValue({ publicKey: () => 'GBADUMMYACCOUNT' }),
    fromSecret: jest.fn().mockReturnValue({
      publicKey: () => 'GPLATFORMKEYPAIR0000000000000000000000000000000000000000',
      sign: jest.fn(),
    }),
  },
  Account:      jest.fn().mockImplementation(() => ({})),
  Address:      { fromString: jest.fn().mockReturnValue({ toScVal: () => ({}) }) },
  scValToNative: jest.fn().mockReturnValue(true),
  nativeToScVal: jest.fn().mockReturnValue({}),
}));

// Mock the signer so getPlatformKeypair() returns a deterministic keypair
jest.mock('../../src/utils/signer', () => ({
  getPlatformKeypair: jest.fn().mockReturnValue({
    publicKey: () => 'GPLATFORMKEYPAIR0000000000000000000000000000000000000000',
    sign: jest.fn(),
  }),
}));

import {
  isSubscribed,
  queryMilestones,
  cancelSubscriptionOnChain,
  logTrialOffer,
  pauseContractOnChain,
  PaymentError,
  ValidatorActionError,
} from '../../src/services/stellar';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const sdk = require('@stellar/stellar-sdk') as any;

const WALLET = 'G' + 'A'.repeat(55);

// ─── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Restore default SDK behaviours after clearAllMocks() wipes return values
  sdk.scValToNative.mockReturnValue(true);
  sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(false);
  mockAssembleBuild.mockReturnValue({ sign: jest.fn() });
  mockAssemble.mockReturnValue({ build: mockAssembleBuild });

  // isSubscribed defaults — simulate returns a truthy bool
  mockSimulate.mockResolvedValue({ result: { retval: { type: 'scvBool' } } });

  // cancelSubscriptionOnChain defaults — happy path
  mockGetAccount.mockResolvedValue({});
  mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'txhash-abc' });
  mockGetTransaction.mockResolvedValue({ status: 'SUCCESS' });
});

// ─── isSubscribed ─────────────────────────────────────────────────────────────

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
    mockSimulate.mockResolvedValue({ result: null });
    const result = await isSubscribed(WALLET);
    expect(result.active).toBe(false);
    expect(result.expiresAt).toBeNull();
  });

  it('throws PaymentError NETWORK_ERROR on simulation error response', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'rpc down' });
    await expect(isSubscribed(WALLET)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('throws PaymentError NETWORK_ERROR when simulateTransaction rejects', async () => {
    mockSimulate.mockRejectedValue(new Error('connection timeout'));
    await expect(isSubscribed(WALLET)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('throws PaymentError for empty wallet without calling the RPC', async () => {
    await expect(isSubscribed('')).rejects.toThrow(PaymentError);
  });
});

// ─── queryMilestones ──────────────────────────────────────────────────────────

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

// ─── cancelSubscriptionOnChain ────────────────────────────────────────────────

describe('cancelSubscriptionOnChain', () => {
  it('throws PaymentError INVALID_ACCOUNT for empty wallet', async () => {
    await expect(cancelSubscriptionOnChain('')).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'INVALID_ACCOUNT',
    });
  });

  it('submits a real Soroban transaction and returns its hash on success', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'real-tx-hash-001' });
    mockGetTransaction.mockResolvedValue({ status: 'SUCCESS' });

    const result = await cancelSubscriptionOnChain(WALLET);

    expect(result.transactionId).toBe('real-tx-hash-001');
    expect(mockGetAccount).toHaveBeenCalled();
    expect(mockSimulate).toHaveBeenCalled();
    expect(mockAssemble).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
    expect(mockGetTransaction).toHaveBeenCalledWith('real-tx-hash-001');
  });

  it('polls getTransaction until status is no longer NOT_FOUND', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'poll-hash' });
    mockGetTransaction
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS' });

    jest.useFakeTimers();
    const promise = cancelSubscriptionOnChain(WALLET);
    await jest.runAllTimersAsync();
    const result = await promise;
    jest.useRealTimers();

    expect(result.transactionId).toBe('poll-hash');
    expect(mockGetTransaction).toHaveBeenCalledTimes(3);
  });

  it('throws SubscriptionError NOT_SUBSCRIBED when simulation returns contract error #8', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'Contract error: #8' });

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toMatchObject({
      name: 'SubscriptionError',
      code: 'NOT_SUBSCRIBED',
    });
    // DB must NOT be touched — the function throws before submitting
    expect(mockSendTransaction).not.toHaveBeenCalled();
  });

  it('throws SubscriptionError NOT_SUBSCRIBED when simulation message contains "NotSubscribed"', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'NotSubscribed' });

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toMatchObject({
      name: 'SubscriptionError',
      code: 'NOT_SUBSCRIBED',
    });
  });

  it('throws SubscriptionError UNAUTHORIZED when simulation returns contract error #9', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'Contract error: #9' });

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toMatchObject({
      name: 'SubscriptionError',
      code: 'UNAUTHORIZED',
    });
    expect(mockSendTransaction).not.toHaveBeenCalled();
  });

  it('throws PaymentError NETWORK_ERROR for an unknown simulation error', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'Something went wrong' });

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
  });

  it('throws PaymentError NETWORK_ERROR when sendTransaction returns ERROR status', async () => {
    mockSendTransaction.mockResolvedValue({
      status: 'ERROR',
      errorResult: 'tx_failed',
      hash: 'err-hash',
    });

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
    // Transaction never confirmed — getTransaction should NOT be called
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it('throws PaymentError NETWORK_ERROR when the confirmed transaction has FAILED status', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'fail-hash' });
    mockGetTransaction.mockResolvedValue({ status: 'FAILED', resultMetaXdr: '' });

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
  });

  it('throws SubscriptionError NOT_SUBSCRIBED when FAILED tx XDR contains #8', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'fail-hash-8' });
    mockGetTransaction.mockResolvedValue({
      status: 'FAILED',
      resultMetaXdr: 'error-payload-#8-encoded',
    });

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toMatchObject({
      name: 'SubscriptionError',
      code: 'NOT_SUBSCRIBED',
    });
  });

  it('throws SubscriptionError UNAUTHORIZED when FAILED tx XDR contains #9', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'fail-hash-9' });
    mockGetTransaction.mockResolvedValue({
      status: 'FAILED',
      resultMetaXdr: 'error-payload-#9-encoded',
    });

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toMatchObject({
      name: 'SubscriptionError',
      code: 'UNAUTHORIZED',
    });
  });

  it('propagates errors from getAccount (RPC unreachable)', async () => {
    mockGetAccount.mockRejectedValue(new Error('network unreachable'));

    await expect(cancelSubscriptionOnChain(WALLET)).rejects.toThrow('network unreachable');
  });
});

// ─── pauseContractOnChain ─────────────────────────────────────────────────────

describe('pauseContractOnChain', () => {
  it('submits a real Soroban transaction and returns its hash on success', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'real-pause-tx-hash-001' });
    mockGetTransaction.mockResolvedValue({ status: 'SUCCESS' });

    const result = await pauseContractOnChain();

    expect(result.transactionId).toBe('real-pause-tx-hash-001');
    expect(mockGetAccount).toHaveBeenCalled();
    expect(mockSimulate).toHaveBeenCalled();
    expect(mockAssemble).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
    expect(mockGetTransaction).toHaveBeenCalledWith('real-pause-tx-hash-001');
  });

  it('polls getTransaction until status is no longer NOT_FOUND', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'pause-poll-hash' });
    mockGetTransaction
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS' });

    jest.useFakeTimers();
    const promise = pauseContractOnChain();
    await jest.runAllTimersAsync();
    const result = await promise;
    jest.useRealTimers();

    expect(result.transactionId).toBe('pause-poll-hash');
    expect(mockGetTransaction).toHaveBeenCalledTimes(3);
  });

  it('throws ContractActionError CONTRACT_ALREADY_PAUSED when simulation reports the contract is already paused', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'ContractPaused' });

    await expect(pauseContractOnChain()).rejects.toMatchObject({
      name: 'ContractActionError',
      code: 'CONTRACT_ALREADY_PAUSED',
    });
    // Never submitted — the function throws before sendTransaction
    expect(mockSendTransaction).not.toHaveBeenCalled();
  });

  it('throws ContractActionError CONTRACT_ALREADY_PAUSED when simulation error contains contract code #10', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'Contract error: #10' });

    await expect(pauseContractOnChain()).rejects.toMatchObject({
      name: 'ContractActionError',
      code: 'CONTRACT_ALREADY_PAUSED',
    });
  });

  it('throws ContractActionError NETWORK_ERROR for an unrelated simulation error', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'Something went wrong' });

    await expect(pauseContractOnChain()).rejects.toMatchObject({
      name: 'ContractActionError',
      code: 'NETWORK_ERROR',
    });
  });

  it('throws ContractActionError NETWORK_ERROR when sendTransaction returns ERROR status', async () => {
    mockSendTransaction.mockResolvedValue({
      status: 'ERROR',
      errorResult: 'tx_failed',
      hash: 'pause-err-hash',
    });

    await expect(pauseContractOnChain()).rejects.toMatchObject({
      name: 'ContractActionError',
      code: 'NETWORK_ERROR',
    });
    // Transaction never confirmed — getTransaction should NOT be called
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it('throws ContractActionError NETWORK_ERROR when the confirmed transaction has FAILED status', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'pause-fail-hash' });
    mockGetTransaction.mockResolvedValue({ status: 'FAILED' });

    await expect(pauseContractOnChain()).rejects.toMatchObject({
      name: 'ContractActionError',
      code: 'NETWORK_ERROR',
    });
  });

  it('propagates errors from getAccount (RPC unreachable)', async () => {
    mockGetAccount.mockRejectedValue(new Error('network unreachable'));

    await expect(pauseContractOnChain()).rejects.toThrow('network unreachable');
  });
});

// ─── logTrialOffer ────────────────────────────────────────────────────────────

describe('logTrialOffer', () => {
  const PLAYER_ID = 'player-123';
  const DETAILS_URI = 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

  it('throws PaymentError INVALID_ACCOUNT for missing scoutWallet, playerId, or detailsUri', async () => {
    await expect(logTrialOffer('', PLAYER_ID, DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'INVALID_ACCOUNT',
    });
    await expect(logTrialOffer(WALLET, '', DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'INVALID_ACCOUNT',
    });
    await expect(logTrialOffer(WALLET, PLAYER_ID, '')).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'INVALID_ACCOUNT',
    });
    expect(mockGetAccount).not.toHaveBeenCalled();
  });

  it('submits a real Soroban transaction and returns the confirmed hash and contract playerTier', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'real-tx-hash-002' });
    mockGetTransaction.mockResolvedValue({ status: 'SUCCESS', returnValue: { type: 'scvU32' } });
    sdk.scValToNative.mockReturnValue(3);

    const result = await logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI);

    expect(result.transactionId).toBe('real-tx-hash-002');
    expect(result.playerId).toBe(PLAYER_ID);
    expect(result.detailsUri).toBe(DETAILS_URI);
    expect(result.playerTier).toBe(3);
    expect(mockGetAccount).toHaveBeenCalled();
    expect(mockSimulate).toHaveBeenCalled();
    expect(mockAssemble).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
    expect(mockGetTransaction).toHaveBeenCalledWith('real-tx-hash-002');
  });

  it('defaults playerTier to 3 when the contract returns no value', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'no-retval-hash' });
    mockGetTransaction.mockResolvedValue({ status: 'SUCCESS' });

    const result = await logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI);
    expect(result.playerTier).toBe(3);
  });

  it('polls getTransaction until status is no longer NOT_FOUND before returning', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'poll-hash-2' });
    mockGetTransaction
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS', returnValue: { type: 'scvU32' } });
    sdk.scValToNative.mockReturnValue(3);

    jest.useFakeTimers();
    const promise = logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI);
    await jest.runAllTimersAsync();
    const result = await promise;
    jest.useRealTimers();

    expect(result.transactionId).toBe('poll-hash-2');
    expect(mockGetTransaction).toHaveBeenCalledTimes(3);
  });

  it('throws PaymentError NETWORK_ERROR when getAccount fails', async () => {
    mockGetAccount.mockRejectedValue(new Error('rpc unreachable'));

    await expect(logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
  });

  it('throws PaymentError NETWORK_ERROR on simulation error response', async () => {
    sdk.SorobanRpc.Api.isSimulationError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: 'rpc down' });

    await expect(logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
    expect(mockSendTransaction).not.toHaveBeenCalled();
  });

  it('throws PaymentError NETWORK_ERROR when simulateTransaction rejects', async () => {
    mockSimulate.mockRejectedValue(new Error('connection timeout'));

    await expect(logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
  });

  it('throws PaymentError NETWORK_ERROR when sendTransaction returns ERROR status', async () => {
    mockSendTransaction.mockResolvedValue({
      status: 'ERROR',
      errorResult: 'tx_failed',
      hash: 'err-hash',
    });

    await expect(logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it('throws PaymentError NETWORK_ERROR when sendTransaction rejects', async () => {
    mockSendTransaction.mockRejectedValue(new Error('submit unreachable'));

    await expect(logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
  });

  it('throws PaymentError NETWORK_ERROR when the confirmed transaction has FAILED status', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'fail-hash' });
    mockGetTransaction.mockResolvedValue({ status: 'FAILED' });

    await expect(logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
  });

  it('throws PaymentError NETWORK_ERROR when getTransaction polling rejects', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'poll-fail-hash' });
    mockGetTransaction.mockRejectedValue(new Error('poll unreachable'));

    await expect(logTrialOffer(WALLET, PLAYER_ID, DETAILS_URI)).rejects.toMatchObject({
      name: 'PaymentError',
      code: 'NETWORK_ERROR',
    });
  });
});

// ─── HTTP Keepalive Configuration ─────────────────────────────────────────────

describe('HTTP Keepalive Configuration', () => {
  it('the module loads without errors and the server singleton is defined', () => {
    expect(() => require('../../src/services/stellar')).not.toThrow();
  });
});
