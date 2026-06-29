import { Request, Response, NextFunction } from 'express';
import { getEvents } from '../services/indexer';
import { invokeContract, strVal, ContractExecutionError } from '../utils/contract';
import { AdminEvent, FeeHistoryItem, ApiResponse } from '../types';

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

/** GET /api/admin/events */
export async function getAllEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const events = getEvents() as unknown as AdminEvent[];
    const body: ApiResponse<AdminEvent[]> = { success: true, data: events };
    res.json(body);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/fees — returns fees_withdrawn event payloads */
export async function getFeeSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const withdrawals = getEvents('fees_withdrawn').map((e) => e.payload as unknown as FeeHistoryItem);
    const body: ApiResponse<FeeHistoryItem[]> = { success: true, data: withdrawals };
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
      res.status(400).json({ success: false, error: 'validatorWallet must be a valid Stellar address' });
      return;
    }

    // 404 if validator not currently registered
    const registered = getEvents('validator_registered' as any).map((e) => e.payload.validator);
    const revoked = getEvents('validator_revoked' as any).map((e) => e.payload.validator);
    const isActive = registered.includes(validatorWallet) && !revoked.includes(validatorWallet);

    if (!isActive) {
      res.status(404).json({ success: false, error: `Validator ${validatorWallet} is not currently registered` });
      return;
    }

    const { hash } = await invokeContract('revoke_validator', [strVal(validatorWallet)]);

    console.info(`[admin] action=revoke_validator admin=${adminWallet} target=${validatorWallet} txHash=${hash}`);
    res.status(202).json({
      success: true,
      message: `Validator ${validatorWallet} revocation submitted`,
      transactionId: hash,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/contract/pause */
export async function pauseContract(req: Request, res: Response, next: NextFunction) {
  try {
    const adminWallet = (req as any).account as string;

    // 409 if already paused — check contract_paused events
    const paused = getEvents('contract_paused' as any);
    const unpaused = getEvents('contract_unpaused' as any);
    if (paused.length > unpaused.length) {
      res.status(409).json({ success: false, error: 'Contract is already paused' });
      return;
    }

    const { hash } = await invokeContract('pause', []);

    console.info(`[admin] action=pause_contract admin=${adminWallet} txHash=${hash}`);
    res.status(202).json({
      success: true,
      message: `Contract paused successfully`,
      transactionId: hash,
    });
  } catch (err) {
    if (err instanceof ContractExecutionError && err.message.includes('ContractPaused')) {
      res.status(409).json({ success: false, error: 'Contract is already paused' });
      return;
    }
    next(err);
  }
}
