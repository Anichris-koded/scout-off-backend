// Mock config BEFORE importing the ipfs module so isPinataConfigured() returns true
jest.mock('../../src/config', () => ({
  __esModule: true,
  default: {
    pinata: { apiKey: 'test-key', secret: 'test-secret', gateway: 'https://gateway.pinata.cloud' },
    logLevel: 'warn',
    nodeEnv: 'test',
  },
}));

// Mock axios so we can control Pinata responses
jest.mock('axios');
import axios from 'axios';
const mockedPost = jest.fn();
(axios as jest.Mocked<typeof axios>).post = mockedPost;

// Mock DB helpers so we can inspect insertPendingPin calls
jest.mock('../../src/db', () => ({
  insertPendingPin: jest.fn(),
  getPendingPins: jest.fn().mockReturnValue([]),
  deletePendingPin: jest.fn(),
  incrementPendingPinAttempts: jest.fn(),
}));

import { insertPendingPin } from '../../src/db';

// Mock logger to capture critical calls
const mockCritical = jest.fn();
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    critical: mockCritical,
  },
}));

import { pinJson } from '../../src/services/ipfs';

describe('pinJson IPFS failure handling (#346)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs CRITICAL when Pinata throws', async () => {
    mockedPost.mockRejectedValue(new Error('Pinata 503'));
    await expect(pinJson({ wallet: 'Gtest' })).rejects.toThrow('Pinata 503');
    expect(mockCritical).toHaveBeenCalledWith(
      expect.stringContaining('[ipfs] Pinata unavailable'),
      expect.any(String)
    );
  });

  it('queues payload to pending_pins when Pinata throws', async () => {
    mockedPost.mockRejectedValue(new Error('connection refused'));
    const body = { wallet: 'Gqueue', position: 'striker' };
    await expect(pinJson(body)).rejects.toThrow();
    expect(insertPendingPin).toHaveBeenCalledWith(body);
  });

  it('does not call critical or queue on successful pin', async () => {
    mockedPost.mockResolvedValue({ data: { IpfsHash: 'QmSuccess' } });
    const cid = await pinJson({ wallet: 'Gok' });
    expect(cid).toBe('QmSuccess');
    expect(mockCritical).not.toHaveBeenCalled();
    expect(insertPendingPin).not.toHaveBeenCalled();
  });
});
