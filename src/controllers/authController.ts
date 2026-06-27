import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Keypair } from '@stellar/stellar-sdk';
import { buildChallenge, verifyAndIssueToken, extractAccount } from '../services/sep10';
import { logger } from '../utils/logger';
import { extractClientIp } from '../utils/ipExtractor';
import config from '../config';

const TOKEN_TTL_SECONDS = 86400;

const challengeSchema = z.object({
  account: z.string().refine(
    (val) => { try { Keypair.fromPublicKey(val); return true; } catch { return false; } },
    { message: 'Invalid Stellar public key' }
  ),
});

const tokenSchema = z.object({
  transaction: z.string().min(1),
  role: z.enum(['player', 'scout', 'validator', 'admin']).optional(),
});

/** GET /auth/challenge?account=G... */
export function getChallenge(req: Request, res: Response, next: NextFunction): void {
  try {
    const parsed = challengeSchema.safeParse(req.query);
    if (!parsed.success) {
      logger.warn('[auth] failed_challenge_request', {
        correlationId: req.correlationId,
        origin: extractClientIp(req),
        attemptedAccount: (req.query.account as string) ?? null,
        reason: parsed.error.errors[0]?.message,
      });
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }
    const challenge = buildChallenge(parsed.data.account);
    res.json({ challenge, networkPassphrase: config.networkPassphrase });
  } catch (err) {
    next(err);
  }
}

/** POST /auth/token  { transaction: "<signed XDR>", role?: "validator" } */
export function postToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('[auth] failed_token_request invalid_body', {
        correlationId: req.correlationId,
        origin: extractClientIp(req),
        reason: parsed.error.errors[0]?.message,
      });
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }
    const { transaction, role } = parsed.data;
    // Seed admin: if the authenticated wallet matches ADMIN_WALLET, always issue admin role
    const candidate = extractAccount(transaction);
    const effectiveRole =
      config.adminWallet && candidate === config.adminWallet ? 'admin' : role;
    const { token, account } = verifyAndIssueToken(transaction, effectiveRole);
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    res.json({ token, account, expiresAt });
  } catch (err) {
    if (err instanceof Error && (
      err.message === 'Invalid challenge signature' ||
      err.message === 'Missing source account in challenge'
    )) {
      let attemptedWallet: string | null = null;
      try { attemptedWallet = extractAccount((req.body as { transaction?: string }).transaction ?? ''); } catch { /* not extractable */ }
      logger.warn('[auth] failed_token_exchange', {
        correlationId: req.correlationId,
        origin: extractClientIp(req),
        attemptedWallet,
        reason: err.message,
      });
      res.status(401).json({ success: false, error: err.message });
      return;
    }
    next(err);
  }
}
