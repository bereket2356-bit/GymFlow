import { Router } from "express";
import { login, logout, me } from "../controllers/authController.js";
import { loginBody } from "../validators/authValidators.js";
import { validate } from "../middleware/validate.js";
import { requireOwner } from "../middleware/auth.js";
import { loginEmailLimiter, loginIpLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/login", loginIpLimiter, loginEmailLimiter, validate({ body: loginBody }), login);
router.post("/logout", requireOwner, logout);
router.get("/me", requireOwner, me);

export default router;
