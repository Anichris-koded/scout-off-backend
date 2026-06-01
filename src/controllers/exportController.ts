import { Request, Response, NextFunction } from 'express';

/**
 * GET /api/admin/events/export
 *
 * Placeholder endpoint — returns contract events as CSV.
 *
 * Intended export structure:
 *   event_type  — Soroban contract event name (e.g. player_registered)
 *   ledger      — ledger sequence number when the event was emitted
 *   timestamp   — Unix epoch seconds
 *   payload     — JSON-encoded event payload
 *
 * TODO: replace stub rows with real indexer data once CSV serialisation
 *       is implemented.
 */
export async function exportEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const csv = [
      'event_type,ledger,timestamp,payload',
      'player_registered,1000,1700000000,"{}"',
      'milestone_approved,1001,1700000060,"{}"',
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="events.csv"');
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}
