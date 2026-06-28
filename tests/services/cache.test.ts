/**
 * Tests for the player list cache: hit/miss behaviour and invalidation.
 * Uses the real cache module (not mocked) to verify actual cache logic.
 */

// Isolate the cache module between tests so state doesn't leak.
let cacheModule: typeof import('../../src/services/cache');

beforeEach(() => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cacheModule = require('../../src/services/cache');
});

describe('cacheGet / cacheSet', () => {
  it('returns undefined for a key that has never been set', () => {
    expect(cacheModule.cacheGet('players:list:{}' )).toBeUndefined();
  });

  it('returns the stored value immediately after cacheSet', () => {
    cacheModule.cacheSet('players:list:{"region":"eu"}', { data: [], total: 0 });
    expect(cacheModule.cacheGet('players:list:{"region":"eu"}')).toEqual({ data: [], total: 0 });
  });

  it('returns undefined after TTL expires', () => {
    jest.useFakeTimers();
    cacheModule.cacheSet('players:list:ttl', { data: [] }, 500);
    jest.advanceTimersByTime(600);
    expect(cacheModule.cacheGet('players:list:ttl')).toBeUndefined();
    jest.useRealTimers();
  });

  it('still returns value before TTL expires', () => {
    jest.useFakeTimers();
    cacheModule.cacheSet('players:list:ttl2', { data: ['x'] }, 500);
    jest.advanceTimersByTime(400);
    expect(cacheModule.cacheGet('players:list:ttl2')).toEqual({ data: ['x'] });
    jest.useRealTimers();
  });
});

describe('invalidatePlayerCache', () => {
  it('clears all players:list: prefixed entries', () => {
    cacheModule.cacheSet('players:list:{}', { data: [] });
    cacheModule.cacheSet('players:list:{"region":"eu"}', { data: [] });

    cacheModule.invalidatePlayerCache();

    expect(cacheModule.cacheGet('players:list:{}')).toBeUndefined();
    expect(cacheModule.cacheGet('players:list:{"region":"eu"}')).toBeUndefined();
  });

  it('does not clear non-list player entries when no playerId is given', () => {
    cacheModule.cacheSet('players:abc123', { wallet: 'G...' });

    cacheModule.invalidatePlayerCache();

    expect(cacheModule.cacheGet('players:abc123')).toBeDefined();
  });

  it('clears the specific player entry when playerId is supplied', () => {
    cacheModule.cacheSet('players:abc123', { wallet: 'G...' });
    cacheModule.cacheSet('players:list:{}', { data: [] });

    cacheModule.invalidatePlayerCache('abc123');

    expect(cacheModule.cacheGet('players:abc123')).toBeUndefined();
    expect(cacheModule.cacheGet('players:list:{}')).toBeUndefined();
  });
});

describe('invalidateMilestoneCache', () => {
  it('clears the milestone entry and all list entries', () => {
    cacheModule.cacheSet('milestones:p1', [{ id: 1 }]);
    cacheModule.cacheSet('players:list:{}', { data: [] });

    cacheModule.invalidateMilestoneCache('p1');

    expect(cacheModule.cacheGet('milestones:p1')).toBeUndefined();
    expect(cacheModule.cacheGet('players:list:{}')).toBeUndefined();
  });
});
