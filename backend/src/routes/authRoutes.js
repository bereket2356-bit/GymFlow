import { Router } from "express";
import { changePassword, login, logout, me, signOutAll, updateProfile } from "../controllers/authController.js";
import {
  changePasswordBody,
  loginBody,
  signOutAllBody,
  updateProfileBody,
} from "../validators/authValidators.js";
import { validate } from "../middleware/validate.js";
import { requireOwner } from "../middleware/auth.js";
import {
  loginEmailLimiter,
  loginIpLimiter,
  passwordChangeLimiter,
  signOutAllLimiter,
} from "../middleware/rateLimit.js";

const router = Router();

router.post("/login", loginIpLimiter, loginEmailLimiter, validate({ body: loginBody }), login);
router.post("/logout", requireOwner, logout);
router.get("/me", requireOwner, me);
router.patch("/me", requireOwner, validate({ body: updateProfileBody }), updateProfile);
router.post(
  "/change-password",
  requireOwner,
  passwordChangeLimiter,
  validate({ body: changePasswordBody }),
  changePassword,
);
router.post(
  "/sign-out-all",
  requireOwner,
  signOutAllLimiter,
  validate({ body: signOutAllBody }),
  signOutAll,
);

export default router;
