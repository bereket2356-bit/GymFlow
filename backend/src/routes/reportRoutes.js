import { Router } from "express";
import { csv, heatmap, outstanding, payments, summary } from "../controllers/reportController.js";
import { exportQuery, reportQuery, weeklyQuery } from "../validators/reportValidators.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/summary", validate({ query: reportQuery }), summary);
router.get("/payments-by-week", validate({ query: weeklyQuery }), payments);
router.get("/attendance-heatmap", validate({ query: weeklyQuery }), heatmap);
router.get("/outstanding", outstanding);
router.get("/export.csv", validate({ query: exportQuery }), csv);

export default router;
