import { recordAudit, auditStore, AuditEntry } from '../../src/utils/audit';

beforeEach(() => {
  auditStore.length = 0;
});

describe('recordAudit', () => {
  it('returns an entry with actorWallet, eventType, payloadHash, and timestamp', () => {
    const entry = recordAudit('GTEST123', 'player_registered', { foo: 'bar' });
    expect(entry.actorWallet).toBe('GTEST123');
    expect(entry.eventType).toBe('player_registered');
    expect(typeof entry.payloadHash).toBe('string');
    expect(entry.payloadHash).toHaveLength(64); // SHA-256 hex
    expect(typeof entry.timestamp).toBe('number');
  });

  it('appends entry to auditStore', () => {
    recordAudit('GWALLET', 'profile_updated', { region: 'EU' });
    expect(auditStore).toHaveLength(1);
    expect(auditStore[0].eventType).toBe('profile_updated');
  });

  it('produces a deterministic hash for the same payload', () => {
    const a = recordAudit('GW', 'player_registered', { x: 1 });
    const b = recordAudit('GW', 'player_registered', { x: 1 });
    expect(a.payloadHash).toBe(b.payloadHash);
  });

  it('produces different hashes for different payloads', () => {
    const a = recordAudit('GW', 'player_registered', { x: 1 });
    const b = recordAudit('GW', 'player_registered', { x: 2 });
    expect(a.payloadHash).not.toBe(b.payloadHash);
  });
});
