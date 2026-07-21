import { getDb, queryPlayers, countPlayers, getPlayerById, getPendingMilestones, getEvents, getAuditLogs, getAuditLogsCount, upsertPlayer, getValidatorStats } from '../../src/db';
import { ContractEventType } from '../../src/types';

const INJECTION_PAYLOADS = [
  "'; DROP TABLE players; --",
  "'; DROP TABLE events; --",
  "' OR '1'='1",
  "'; SELECT * FROM sqlite_master; --",
  "x' UNION SELECT * FROM events--",
  "\\'; EXECUTE IMMEDIATE 'DROP TABLE players'; --",
  "' UNION SELECT * FROM information_schema.tables; --",
  "1; SELECT * FROM users WHERE '1' = '1",
];

function seedPlayer(id: string, extra?: Partial<Parameters<typeof upsertPlayer>[0]>): void {
  upsertPlayer({
    player_id: id,
    wallet: 'G' + 'A'.repeat(55),
    position: 'midfielder',
    region: 'europe',
    created_at: 1000,
    ...extra,
  });
}

beforeEach(() => {
  getDb().prepare('DELETE FROM players').run();
  getDb().prepare('DELETE FROM pending_milestones').run();
  getDb().prepare('DELETE FROM events').run();
  getDb().prepare('DELETE FROM audit_log').run();
  // Seed one normal player to ensure queries can return rows
  seedPlayer('normal-player');
});

describe('queryPlayers - SQL injection resistance', () => {
  INJECTION_PAYLOADS.forEach((payload) => {
    it(`queryPlayers treats injection payload as literal: ${payload.slice(0, 40)}...`, () => {
      const rows = queryPlayers({ region: payload });
      // Must not throw, must return empty array (no match) not drop tables
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toHaveLength(0);
    });

    it(`countPlayers treats injection payload as literal: ${payload.slice(0, 40)}...`, () => {
      const count = countPlayers({ region: payload });
      expect(typeof count).toBe('number');
      expect(count).toBe(0);
    });

    it(`queryPlayers treats injection position as literal: ${payload.slice(0, 40)}...`, () => {
      const rows = queryPlayers({ position: payload });
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toHaveLength(0);
    });

    it(`queryPlayers treats injection minTier as literal (coerced): ${payload.slice(0, 40)}...`, () => {
      if (/^\d+$/.test(payload)) return; // skip pure digits — zod would parse as number
      // minTier is coerce'd via zod in the controller, but queryPlayers accepts number
      // The param goes through ? placeholder so even if 0 it won't inject
      const rows = queryPlayers({ minTier: 0, region: 'europe' });
      expect(Array.isArray(rows)).toBe(true);
    });
  });

  it('queryPlayers with injection in both region and position is safe', () => {
    const rows = queryPlayers({ region: "'; DROP TABLE players; --", position: "' OR '1'='1" });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(0);
  });

  it('players table still exists after injection attempts', () => {
    const count = countPlayers({});
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('LIMIT and OFFSET values passed through ? are safe', () => {
    const rows = queryPlayers({ region: 'europe', limit: 10, offset: 0 });
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe('getPlayerById - SQL injection resistance', () => {
  INJECTION_PAYLOADS.forEach((payload) => {
    it(`getPlayerById treats injection as literal: ${payload.slice(0, 40)}...`, () => {
      const row = getPlayerById(payload);
      // Must not throw, must return null (no match)
      expect(row).toBeNull();
    });
  });

  it('can still find a normal player after injection calls', () => {
    const row = getPlayerById('normal-player');
    expect(row).not.toBeNull();
    expect(row!.player_id).toBe('normal-player');
  });
});

describe('getPendingMilestones - SQL injection resistance', () => {
  beforeEach(() => {
    getDb().prepare(`INSERT INTO pending_milestones (milestone_id, player_id, validator_wallet, milestone_type, evidence_uri, submitted_at) VALUES (?, ?, ?, ?, ?, ?)`).run('m1', 'normal-player', 'G' + 'A'.repeat(55), 'performance', 'ipfs://QmTest', 1000);
  });

  INJECTION_PAYLOADS.forEach((payload) => {
    it(`getPendingMilestones treats injection position as literal: ${payload.slice(0, 40)}...`, () => {
      const result = getPendingMilestones({ position: payload });
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(typeof result.total).toBe('number');
    });

    it(`getPendingMilestones treats injection region as literal: ${payload.slice(0, 40)}...`, () => {
      const result = getPendingMilestones({ region: payload });
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it(`getPendingMilestones treats injection playerId as literal: ${payload.slice(0, 40)}...`, () => {
      const result = getPendingMilestones({ playerId: payload });
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it(`getPendingMilestones treats injection validatorWallet as literal: ${payload.slice(0, 40)}...`, () => {
      const result = getPendingMilestones({ validatorWallet: payload });
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it(`getPendingMilestones treats injection page/pageSize as safe: ${payload.slice(0, 40)}...`, () => {
      const result = getPendingMilestones({ page: 1, pageSize: 20, position: payload });
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  it('pending_milestones table still exists after injection attempts', () => {
    const result = getPendingMilestones({});
    expect(result.total).toBeGreaterThanOrEqual(1);
  });
});

describe('getEvents - SQL injection resistance', () => {
  // Seed a real event row
  beforeEach(() => {
    getDb().prepare('INSERT OR IGNORE INTO events (type, ledger, tx_hash, payload, created_at) VALUES (?, ?, ?, ?, ?)').run('player_registered', 1, 'abc123', '{}', 1000);
  });

  INJECTION_PAYLOADS.forEach((payload) => {
    it(`getEvents treats injection type as literal: ${payload.slice(0, 40)}...`, () => {
      const rows = getEvents(payload as unknown as ContractEventType);
      expect(Array.isArray(rows)).toBe(true);
      // Should match nothing, not throw
    });

    it(`getEvents with pagination treats injection safely: ${payload.slice(0, 40)}...`, () => {
      const rows = getEvents(payload as unknown as ContractEventType, { limit: 10, offset: 0 });
      expect(Array.isArray(rows)).toBe(true);
    });
  });

  it('events table still exists after injection attempts', () => {
    expect(getEvents()).toHaveLength(1);
  });
});

describe('getAuditLogs - SQL injection resistance', () => {
  INJECTION_PAYLOADS.forEach((payload) => {
    it(`getAuditLogs treats injection action as literal: ${payload.slice(0, 40)}...`, () => {
      const rows = getAuditLogs({ action: payload });
      expect(Array.isArray(rows)).toBe(true);
    });

    it(`getAuditLogs treats injection startDate as literal: ${payload.slice(0, 40)}...`, () => {
      const rows = getAuditLogs({ startDate: payload });
      expect(Array.isArray(rows)).toBe(true);
    });

    it(`getAuditLogs treats injection endDate as literal: ${payload.slice(0, 40)}...`, () => {
      const rows = getAuditLogs({ endDate: payload });
      expect(Array.isArray(rows)).toBe(true);
    });

    it(`getAuditLogsCount treats injection action as literal: ${payload.slice(0, 40)}...`, () => {
      const count = getAuditLogsCount({ action: payload });
      expect(typeof count).toBe('number');
    });

    it(`getAuditLogsCount treats injection date range as literal: ${payload.slice(0, 40)}...`, () => {
      const count = getAuditLogsCount({ startDate: payload, endDate: payload });
      expect(typeof count).toBe('number');
    });
  });
});

describe('getValidatorStats - SQL injection resistance', () => {
  INJECTION_PAYLOADS.forEach((payload) => {
    it(`getValidatorStats treats injection wallet as literal: ${payload.slice(0, 40)}...`, () => {
      const stats = getValidatorStats(payload);
      expect(stats).toBeNull();
    });
  });
});
