import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import {
  registerPlayer,
  getPlayer,
  filterPlayers,
  getPlayerMilestones,
  updatePlayer,
  registerSchema,
  filterSchema,
  updatePlayerSchema,
} from "../controllers/playerController";
import { getPlayerHistory } from "../controllers/playerHistoryController";
import { acceptTrialOffer, rejectTrialOffer, rejectOfferSchema } from "../controllers/trialOfferController";

import { validateBody, validateQuery } from "../middleware/validate";
import { requireRole, optionalAuth } from "../middleware/auth";
import { requireOwner } from "../middleware/requireOwner";

const router = Router();

const playerIdParams = z.object({ playerId: playerIdSchema });

/**
 * GET /api/players
 * optionalAuth so req.account is set when a Bearer token is present (for audit logging)
 */
router.get("/", optionalAuth, validateQuery(filterSchema), filterPlayers);

router.post(
  "/register",
  requireRole("player"),
  validateBody(registerSchema, { context: "player_registration" }),
  registerPlayer,
);

router.get("/:playerId", getPlayer);

router.get("/:playerId/milestones", getPlayerMilestones);

router.put(
  "/:playerId",
  requireRole("player"),
  requireOwner,
  validateBody(updatePlayerSchema),
  updatePlayer,
);

/**
 * GET /api/players/:playerId/history
 * Admin or profile owner only.
 */
router.get(
  "/:playerId/history",
  (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).role === "admin") {
      return getPlayerHistory(req, res, next);
    }
    return requireRole("player")(req, res, () => requireOwner(req, res, next));
  },
);

/**
 * POST /api/players/:playerId/trial-offers/:offerId/accept
 *
 * Accept a trial offer. Only the player who owns this playerId may respond.
 *
 * @param playerId {string} - The player's on-chain identifier
 * @param offerId  {string} - The trial offer identifier
 * @response 200 { success: true, data: { offerId, playerId, status: 'accepted', respondedAt } }
 * @response 403 { success: false, error: string } - Not the offer's target player
 * @response 404 { success: false, error: string } - Offer not found
 * @response 409 { success: false, error: string } - Offer already responded to
 * @auth Bearer (player role required)
 */
router.post(
  "/:playerId/trial-offers/:offerId/accept",
  requireRole("player"),
  acceptTrialOffer,
);

/**
 * POST /api/players/:playerId/trial-offers/:offerId/reject
 *
 * Reject a trial offer with an optional reason. Only the player who owns this playerId may respond.
 *
 * @param playerId {string} - The player's on-chain identifier
 * @param offerId  {string} - The trial offer identifier
 * @body { reason?: string } - Optional rejection reason (max 500 chars)
 * @response 200 { success: true, data: { offerId, playerId, status: 'rejected', reason, respondedAt } }
 * @response 403 { success: false, error: string } - Not the offer's target player
 * @response 404 { success: false, error: string } - Offer not found
 * @response 409 { success: false, error: string } - Offer already responded to
 * @auth Bearer (player role required)
 */
router.post(
  "/:playerId/trial-offers/:offerId/reject",
  requireRole("player"),
  validateBody(rejectOfferSchema),
  rejectTrialOffer,
);

export default router;
