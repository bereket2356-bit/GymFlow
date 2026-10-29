import { Router } from "express";
import { reminders, review, summary, todaySessions } from "../controllers/dashboardController.js";
import { validate } from "../middleware/validate.js";
import { reminderKeyParams, summaryQuery } from "../validators/dashboardValidators.js";

const router = Router();

router.get("/summary", validate({ query: summaryQuery }), summary);
router.get("/reminders", reminders);
router.post("/reminders/:key/review", validate({ params: reminderKeyParams }), review);
router.get("/sessions-today", todaySessions);

export default router;
