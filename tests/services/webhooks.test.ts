import fetch from 'node-fetch';
import { postWebhookWithRetry } from '../../src/services/webhooks';

jest.mock('node-fetch', () => jest.fn());

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('postWebhookWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns successfully when the first request succeeds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedFetch.mockResolvedValue({ ok: true, status: 200 } as any);

    await expect(postWebhookWithRetry('https://example.com', { eventType: 'test' })).resolves.toBeUndefined();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on an initial failure and succeeds on a later attempt', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('network fail'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedFetch.mockResolvedValue({ ok: true, status: 200 } as any);

    await expect(
      postWebhookWithRetry('https://example.com', { eventType: 'test' }, { retries: 3, baseDelayMs: 1, maxDelayMs: 2 })
    ).resolves.toBeUndefined();

    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries fail', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));

    await expect(
      postWebhookWithRetry('https://example.com', { eventType: 'test' }, { retries: 2, baseDelayMs: 1, maxDelayMs: 2 })
    ).rejects.toThrow('network down');

    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
});
