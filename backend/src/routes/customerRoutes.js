import { Router } from "express";
import {
  archive,
  attendance,
  create,
  detail,
  ledger,
  list,
  remove,
  restore,
  update,
} from "../controllers/customerController.js";
import { createForCustomer } from "../controllers/membershipController.js";
import {
  attendanceQuery,
  createCustomerBody,
  listCustomersQuery,
  updateCustomerBody,
} from "../validators/customerValidators.js";
import { createMembershipBody } from "../validators/membershipValidators.js";
import { idParams } from "../validators/common.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/", validate({ query: listCustomersQuery }), list);
router.post("/", validate({ body: createCustomerBody }), create);
router.get("/:id", validate({ params: idParams }), detail);
router.patch("/:id", validate({ params: idParams, body: updateCustomerBody }), update);
router.delete("/:id", validate({ params: idParams }), remove);
router.post("/:id/archive", validate({ params: idParams }), archive);
router.post("/:id/restore", validate({ params: idParams }), restore);
router.get("/:id/ledger", validate({ params: idParams }), ledger);
router.get("/:id/attendance", validate({ params: idParams, query: attendanceQuery }), attendance);
router.post(
  "/:id/memberships",
  validate({ params: idParams, body: createMembershipBody }),
  createForCustomer,
);

export default router;
