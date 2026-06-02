import { createHash } from 'crypto';

export type AuditEventType =
  | 'player_registered'
  | 'profile_updated'
  | 'milestone_submitted'
  | 'milestone_approved';

export interface AuditEntry {
  actorWallet: string;
  eventType: AuditEventType;
  payloadHash: string;
  timestamp: number;
  /** Optional free-text notes for searchability and context. */
  notes?: string;
}

/** In-memory stub store — replace with a persistent store in production. */
export const auditStore: AuditEntry[] = [];

/**
 * Records an audit entry for a player registration, profile update, or milestone event.
 * @param actorWallet - Stellar wallet address of the actor
 * @param eventType   - Type of event being audited
 * @param payload     - Raw payload to hash (SHA-256)
 * @param notes       - Optional free-text notes for searchability
 */
export function recordAudit(
  actorWallet: string,
  eventType: AuditEventType,
  payload: Record<string, unknown>,
  notes?: string
): AuditEntry {
  const entry: AuditEntry = {
    actorWallet,
    eventType,
    payloadHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    timestamp: Date.now(),
    ...(notes !== undefined ? { notes } : {}),
  };
  auditStore.push(entry);
  return entry;
}

/**
 * Returns all audit entries, optionally filtered by eventType.
 */
export function queryAudit(filter?: { eventType?: AuditEventType; actorWallet?: string }): AuditEntry[] {
  return auditStore.filter((e) => {
    if (filter?.eventType && e.eventType !== filter.eventType) return false;
    if (filter?.actorWallet && e.actorWallet !== filter.actorWallet) return false;
    return true;
  });
}
