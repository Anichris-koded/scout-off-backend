import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { getEvents } from '../services/indexer';
import { AdminEvent, FeeHistoryItem, ApiResponse } from '../types';
import { logAuditEvent } from '../services/audit';
import config from '../config';

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/** GET /api/admin/stats */
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: {
        players: getEvents('player_registered').length,
        milestones: getEvents('milestone_approved').length,
        subscriptions: getEvents('scout_subscribed').length,
        events: getEvents().length,
      },
    });
  } catch (err) {
    next(err);
  }
}

const isoDateString = z
  .string()
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Must be a valid ISO 8601 date string' })
  .transform((v) => new Date(v));

/** Exported so routes can apply validateQuery(adminDateRangeSchema) */
export const adminDateRangeSchema = z.object({
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
  eventType: z.string().optional(),
}).refine(
  (d) => !(d.startDate && d.endDate && d.startDate > d.endDate),
  { message: 'startDate must not be after endDate' }
);

/** GET /api/admin/events */
export async function getAllEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate, eventType } = (req as any).query as z.infer<typeof adminDateRangeSchema>;
    let events = getEvents() as unknown as EventRecord[];
    if (eventType) events = events.filter((e: any) => e.type === eventType);
    if (startDate) events = events.filter((e: any) => new Date(e.timestamp ?? e.created_at ?? 0) >= startDate!);
    if (endDate) events = events.filter((e: any) => new Date(e.timestamp ?? e.created_at ?? 0) <= endDate!);
    const body: ApiResponse<EventRecord[]> = { success: true, data: events };
    res.json(body);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/fees — returns fees_withdrawn event payloads */
export async function getFeeSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const adminWallet = (req as any).account as string ?? 'unknown';
    logAuditEvent({
      action: 'fee_history_query',
      adminWallet,
      queryParams: req.query as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });
    const withdrawals = getEvents('fees_withdrawn').map((e) => e.payload as Record<string, unknown>);
    const body: ApiResponse<Record<string, unknown>[]> = { success: true, data: withdrawals };
    res.json(body);
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/validators/register */
export async function registerValidator(req: Request, res: Response, next: NextFunction) {
  try {
    const adminWallet = (req as any).account as string;
    const { validatorWallet } = req.body as { validatorWallet?: string };

    if (!validatorWallet || !STELLAR_ADDRESS_RE.test(validatorWallet)) {
      console.warn(`[admin] register_validator rejected — invalid address | admin=${adminWallet} target=${validatorWallet}`);
      res.status(400).json({ success: false, error: 'validatorWallet must be a valid Stellar address' });
      return;
    }

    console.info(`[admin] action=register_validator admin=${adminWallet} target=${validatorWallet}`);
    // TODO: invoke register_validator on Soroban contract
    res.status(202).json({ success: true, message: `Validator ${validatorWallet} registration submitted` });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/validators/revoke */
export async function revokeValidator(req: Request, res: Response, next: NextFunction) {
  try {
    const adminWallet = (req as any).account as string;
    const { validatorWallet } = req.body as { validatorWallet?: string };

    if (!validatorWallet || !STELLAR_ADDRESS_RE.test(validatorWallet)) {
      console.warn(`[admin] revoke_validator rejected — invalid address | admin=${adminWallet} target=${validatorWallet}`);
      res.status(400).json({ success: false, error: 'validatorWallet must be a valid Stellar address' });
      return;
    }

    console.info(`[admin] action=revoke_validator admin=${adminWallet} target=${validatorWallet}`);
    // TODO: invoke revoke_validator on Soroban contract
    res.status(202).json({ success: true, message: `Validator ${validatorWallet} revocation submitted` });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/contract/pause
 * Stub: signals intent to pause the Soroban contract. Contract-level behavior is simulated.
 */
export async function pauseContract(req: Request, res: Response, next: NextFunction) {
  try {
    const adminWallet = (req as any).account as string;
    logAuditEvent({
      action: 'contract_state_change',
      adminWallet,
      queryParams: {},
      timestamp: new Date().toISOString(),
      contractAction: 'pause_contract',
    });
    // NOTE: Contract-level pause is simulated. Real invocation will call pause() on the Soroban contract.
    res.status(202).json({
      success: true,
      message: 'Contract pause submitted (simulated)',
      transactionId: 'stub-pause-txn-placeholder',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/contract/unpause
 * Stub: signals intent to unpause the Soroban contract. Contract-level behavior is simulated.
 */
export async function unpauseContract(req: Request, res: Response, next: NextFunction) {
  try {
    const adminWallet = (req as any).account as string;
    logAuditEvent({
      action: 'contract_state_change',
      adminWallet,
      queryParams: {},
      timestamp: new Date().toISOString(),
      contractAction: 'unpause_contract',
    });
    // NOTE: Contract-level unpause is simulated. Real invocation will call unpause() on the Soroban contract.
    res.status(202).json({
      success: true,
      message: 'Contract unpause submitted (simulated)',
      transactionId: 'stub-unpause-txn-placeholder',
    });
  } catch (err) {
    next(err);
  }
}

const introspectSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

/** POST /api/admin/introspect */
export async function introspectToken(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = introspectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(parsed.data.token, config.jwtSecret) as jwt.JwtPayload;
    } catch {
      res.status(400).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    // Return only non-secret metadata fields
    res.json({
      success: true,
      data: {
        sub: payload.sub,
        role: payload.role,
        iat: payload.iat,
        exp: payload.exp,
      },
    });
  } catch (err) {
    next(err);
  }
}
