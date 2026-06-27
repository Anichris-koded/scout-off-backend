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

import { validateBody, validateQuery } from "../middleware/validate";
import { requireRole } from "../middleware/auth";
import { requireOwner } from "../middleware/requireOwner";

const router = Router();

/**
 * GET /api/players
 */
router.get("/", validateQuery(filterSchema), filterPlayers);

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

export default router;
