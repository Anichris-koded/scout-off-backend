import { logger } from '../utils/logger';

export interface AuditEvent {
  action: string;
  adminWallet: string;
  queryParams: Record<string, unknown>;
  timestamp: string;
  /** Optional: contract action name for admin smart contract interactions (e.g. 'pause_contract') */
  contractAction?: string;
}

/**
 * Log an audit event for compliance tracking.
 * TODO: export to external ledger / append-only store.
 */
export function logAuditEvent(event: AuditEvent): void {
  logger.info('[audit]', JSON.stringify(event));
  // Placeholder: forward to external compliance ledger
  // externalLedger.append(event);
}
