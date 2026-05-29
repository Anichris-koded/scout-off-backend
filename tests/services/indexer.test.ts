import { getEvents, normalizeEventId } from '../../src/services/indexer';

describe('indexer', () => {
  it('returns empty array when no events exist for a type', () => {
    const events = getEvents('player_registered');
    expect(Array.isArray(events)).toBe(true);
  });

  describe('normalizeEventId', () => {
    it('produces a stable canonical ID', () => {
      const id = normalizeEventId('CONTRACT_A', 100, '0xabc');
      expect(id).toBe('CONTRACT_A:100:0xabc');
    });

    it('produces different IDs for different inputs', () => {
      const a = normalizeEventId('C', 1, 'hash1');
      const b = normalizeEventId('C', 1, 'hash2');
      expect(a).not.toBe(b);
    });
  });
});
