import { Router } from "express";
import { addAdjustment, create, detail, list } from "../controllers/paymentController.js";
import { adjustmentBody, createPaymentBody, listPaymentsQuery } from "../validators/paymentValidators.js";
import { idParams } from "../validators/common.js";
import { validate } from "../middleware/validate.js";

// There is deliberately no PATCH or DELETE route for payments.
const router = Router();

router.post("/", validate({ body: createPaymentBody }), create);
router.get("/", validate({ query: listPaymentsQuery }), list);
router.get("/:id", validate({ params: idParams }), detail);
router.post("/:id/adjustments", validate({ params: idParams, body: adjustmentBody }), addAdjustment);

export default router;
