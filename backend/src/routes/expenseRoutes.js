import { Router } from "express";
import { addAdjustment, create, list } from "../controllers/expenseController.js";
import {
  createExpenseBody,
  expenseAdjustmentBody,
  listExpensesQuery,
} from "../validators/expenseValidators.js";
import { idParams } from "../validators/common.js";
import { validate } from "../middleware/validate.js";

// Expenses are immutable; corrections are appended, never edited in place.
const router = Router();

router.get("/", validate({ query: listExpensesQuery }), list);
router.post("/", validate({ body: createExpenseBody }), create);
router.post("/:id/adjustments", validate({ params: idParams, body: expenseAdjustmentBody }), addAdjustment);

export default router;
