import { Router } from "express";
import { cancel, detail, renew } from "../controllers/membershipController.js";
import { cancelMembershipBody, renewMembershipBody } from "../validators/membershipValidators.js";
import { idParams } from "../validators/common.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/:id", validate({ params: idParams }), detail);
router.post("/:id/renew", validate({ params: idParams, body: renewMembershipBody }), renew);
router.post("/:id/cancel", validate({ params: idParams, body: cancelMembershipBody }), cancel);

export default router;
