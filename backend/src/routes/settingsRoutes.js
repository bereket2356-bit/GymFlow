import { Router } from "express";
import { read, update } from "../controllers/settingsController.js";
import { updateSettingsBody } from "../validators/settingsValidators.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/", read);
router.patch("/", validate({ body: updateSettingsBody }), update);

export default router;
