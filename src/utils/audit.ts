import { createHash } from 'crypto';

export type AuditEventType = 'player_registered' | 'profile_updated';

export interface AuditEntry {
  actorWallet: string;
  eventType: AuditEventType;
  payloadHash: string;
  timestamp: number;
}

/** In-memory stub store — replace with a persistent store in production. */
export const auditStore: AuditEntry[] = [];

/**
 * Records an audit entry for a player registration or profile update event.
 * @param actorWallet - Stellar wallet address of the actor
 * @param eventType   - Type of event being audited
 * @param payload     - Raw payload to hash (SHA-256)
 */
export function recordAudit(
  actorWallet: string,
  eventType: AuditEventType,
  payload: Record<string, unknown>
): AuditEntry {
  const entry: AuditEntry = {
    actorWallet,
    eventType,
    payloadHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    timestamp: Date.now(),
  };
  auditStore.push(entry);
  return entry;
}
