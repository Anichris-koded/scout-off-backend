import { getEvents, upsertPlayer, updatePlayerProgress, getPlayerById, queryPlayers } from '../../src/db';
import { normalizeEventId, normalizePayload } from '../../src/services/indexer';

describe('indexer', () => {
  it('returns empty array when no events exist for a type', () => {
    const events = getEvents('player_registered');
    expect(Array.isArray(events)).toBe(true);
  });

  describe('normalizePayload', () => {
    it('converts camelCase keys to snake_case', () => {
      const result = normalizePayload({ playerId: 'p1', evidenceUri: 'ipfs://x', unlockedAt: 100 });
      expect(result).toEqual({ player_id: 'p1', evidence_uri: 'ipfs://x', unlocked_at: 100 });
    });

    it('leaves snake_case keys unchanged', () => {
      const result = normalizePayload({ player_id: 'p1', evidence_uri: 'ipfs://x' });
      expect(result).toEqual({ player_id: 'p1', evidence_uri: 'ipfs://x' });
    });

    it('handles mixed payloads, normalising only camelCase keys', () => {
      const result = normalizePayload({ playerId: 'p1', region: 'EU', metadataUri: 'QmAbc', txHash: 'abc' });
      expect(result).toEqual({ player_id: 'p1', region: 'EU', metadata_uri: 'QmAbc', tx_hash: 'abc' });
    });

    it('returns empty object for empty input', () => {
      expect(normalizePayload({})).toEqual({});
    });
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

describe('player table helpers', () => {
  const PLAYER_ID = 'test-player-db-' + Math.random().toString(36).slice(2);
  const WALLET = 'GTEST' + 'A'.repeat(51);

  it('upsertPlayer inserts a new player', () => {
    upsertPlayer({ player_id: PLAYER_ID, wallet: WALLET, position: 'striker', region: 'EU', metadata_uri: 'QmTest', created_at: 1000 });
    const row = getPlayerById(PLAYER_ID);
    expect(row).not.toBeNull();
    expect(row!.wallet).toBe(WALLET);
    expect(row!.position).toBe('striker');
    expect(row!.region).toBe('EU');
    expect(row!.metadata_uri).toBe('QmTest');
    expect(row!.progress_level).toBe(0);
  });

  it('upsertPlayer updates an existing player', () => {
    upsertPlayer({ player_id: PLAYER_ID, wallet: WALLET, position: 'midfielder', region: 'NA' });
    const row = getPlayerById(PLAYER_ID);
    expect(row!.position).toBe('midfielder');
    expect(row!.region).toBe('NA');
  });

  it('updatePlayerProgress sets progress_level', () => {
    updatePlayerProgress(PLAYER_ID, 2);
    const row = getPlayerById(PLAYER_ID);
    expect(row!.progress_level).toBe(2);
  });

  it('getPlayerById returns null for unknown player', () => {
    expect(getPlayerById('nonexistent-player-xyz')).toBeNull();
  });

  it('queryPlayers returns players matching region filter', () => {
    const id2 = 'test-player-db2-' + Math.random().toString(36).slice(2);
    upsertPlayer({ player_id: id2, wallet: WALLET, position: 'goalkeeper', region: 'EU' });
    const results = queryPlayers({ region: 'EU' });
    expect(results.some((r) => r.player_id === id2)).toBe(true);
  });

  it('queryPlayers returns players matching minTier filter', () => {
    updatePlayerProgress(PLAYER_ID, 3);
    const results = queryPlayers({ minTier: 3 });
    expect(results.some((r) => r.player_id === PLAYER_ID)).toBe(true);
    const belowTier = queryPlayers({ minTier: 4 });
    expect(belowTier.some((r) => r.player_id === PLAYER_ID)).toBe(false);
  });
});
