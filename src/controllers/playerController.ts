import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pinJson, gatewayUrl } from '../services/ipfs';
import { getEvents } from '../services/indexer';
import { invalidatePlayerCache } from '../services/cache';
import { ApiResponse } from '../types';

export const registerSchema = z.object({
  wallet: z.string().min(56).max(56),
  position: z.string().min(1),
  region: z.string().min(1),
  metadata: z.record(z.unknown()),
});

export const filterSchema = z.object({
  region: z.string().optional(),
  position: z.string().optional(),
  minTier: z.coerce.number().int().min(0).max(3).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** POST /api/players/register */
export async function registerPlayer(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet, position, region, metadata } = registerSchema.parse(req.body);
    const cid = await pinJson({ wallet, position, region, ...metadata });
    // Invalidate player search cache so new profile appears in results
    invalidatePlayerCache();
    const body: ApiResponse<{ metadataUri: string; gatewayUrl: string }> = {
      success: true,
      data: { metadataUri: cid, gatewayUrl: gatewayUrl(cid) },
    };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}

/** GET /api/players/:playerId */
export async function getPlayer(req: Request, res: Response, next: NextFunction) {
  try {
    const events = getEvents('player_registered').filter(
      (e) => e.payload.player_id === req.params.playerId
    );
    if (!events.length) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }
    const payload = events[0].payload;
    const level = (Number(payload.progress_level ?? 0) as ProgressLevel);
    const { tierName, tierDescription } = getTierMeta(level);
    res.json({ success: true, data: { ...payload, tierName, tierDescription } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/players?region=&position=&minTier= */
export async function filterPlayers(req: Request, res: Response, next: NextFunction) {
  try {
    const { region, position, minTier, page, pageSize } = filterSchema.parse(req.query);
    let players = getEvents('player_registered').map((e) => e.payload);
    if (region) players = players.filter((p) => p.region === region);
    if (position) players = players.filter((p) => p.position === position);
    if (minTier !== undefined)
      players = players.filter((p) => Number(p.progress_level) >= minTier);
    const paginated = players.slice((page - 1) * pageSize, page * pageSize);
    res.json({ success: true, data: paginated, total: players.length, page, pageSize });
  } catch (err) {
    next(err);
  }
}

/** GET /api/players/:playerId/milestones */
export async function getPlayerMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    const milestones = getEvents('milestone_approved').filter(
      (e) => e.payload.player_id === req.params.playerId
    );
    res.json({ success: true, data: milestones });
  } catch (err) {
    next(err);
  }
}
