import { recordAudit, queryAudit, auditStore } from '../../src/utils/audit';

beforeEach(() => {
  auditStore.length = 0;
});

describe('recordAudit', () => {
  it('stores a milestone_submitted entry with correct fields', () => {
    const entry = recordAudit('GVALIDATOR', 'milestone_submitted', { playerId: 'P1', milestoneType: 'identity' });
    expect(entry.actorWallet).toBe('GVALIDATOR');
    expect(entry.eventType).toBe('milestone_submitted');
    expect(typeof entry.payloadHash).toBe('string');
    expect(entry.payloadHash).toHaveLength(64);
    expect(typeof entry.timestamp).toBe('number');
    expect(entry.notes).toBeUndefined();
    expect(auditStore).toHaveLength(1);
  });

  it('stores a milestone_approved entry with notes field', () => {
    const entry = recordAudit('GVALIDATOR', 'milestone_approved', { milestoneId: 'M42' }, 'approved via admin panel');
    expect(entry.eventType).toBe('milestone_approved');
    expect(entry.notes).toBe('approved via admin panel');
    expect(auditStore).toHaveLength(1);
  });

  it('stores a player_search entry linked to a scout wallet', () => {
    const entry = recordAudit('GSCOUT123', 'player_search', { region: 'europe', position: 'striker', resultCount: 5 });
    expect(entry.eventType).toBe('player_search');
    expect(entry.actorWallet).toBe('GSCOUT123');
    expect(typeof entry.payloadHash).toBe('string');
    expect(auditStore).toHaveLength(1);
  });

  it('stores a player_search entry with anonymous wallet when unauthenticated', () => {
    const entry = recordAudit('anonymous', 'player_search', { region: null, position: null, resultCount: 10 });
    expect(entry.actorWallet).toBe('anonymous');
    expect(entry.eventType).toBe('player_search');
  });

  it('produces deterministic hash for the same payload', () => {
    const payload = { playerId: 'P1', milestoneType: 'performance' };
    const a = recordAudit('G1', 'milestone_submitted', payload);
    const b = recordAudit('G1', 'milestone_submitted', payload);
    expect(a.payloadHash).toBe(b.payloadHash);
  });
});

describe('queryAudit', () => {
  beforeEach(() => {
    recordAudit('G1', 'milestone_submitted', { id: '1' });
    recordAudit('G2', 'milestone_approved', { id: '2' });
    recordAudit('G1', 'milestone_approved', { id: '3' });
  });

  it('returns all entries when no filter given', () => {
    expect(queryAudit()).toHaveLength(3);
  });

  it('filters by eventType', () => {
    const results = queryAudit({ eventType: 'milestone_approved' });
    expect(results).toHaveLength(2);
    results.forEach((e) => expect(e.eventType).toBe('milestone_approved'));
  });

  it('filters by actorWallet', () => {
    const results = queryAudit({ actorWallet: 'G1' });
    expect(results).toHaveLength(2);
    results.forEach((e) => expect(e.actorWallet).toBe('G1'));
  });

  it('filters by both eventType and actorWallet', () => {
    const results = queryAudit({ eventType: 'milestone_approved', actorWallet: 'G1' });
    expect(results).toHaveLength(1);
    expect(results[0].actorWallet).toBe('G1');
  });
});
