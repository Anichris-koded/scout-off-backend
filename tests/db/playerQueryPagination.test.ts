import { getDb, queryPlayers, upsertPlayer } from '../../src/db';

describe('queryPlayers pagination', () => {
  beforeEach(() => {
    getDb().prepare('DELETE FROM players').run();
  });

  it('applies SQL-side pagination for filtered players', () => {
    upsertPlayer({ player_id: 'p1', wallet: 'G'.repeat(56), position: 'striker', region: 'europe', created_at: 100 });
    upsertPlayer({ player_id: 'p2', wallet: 'G'.repeat(56), position: 'striker', region: 'europe', created_at: 200 });
    upsertPlayer({ player_id: 'p3', wallet: 'G'.repeat(56), position: 'striker', region: 'asia', created_at: 300 });

    const rows = queryPlayers({ region: 'europe', limit: 1, offset: 1 });

    expect(rows.map((row) => row.player_id)).toEqual(['p2']);
  });
});
