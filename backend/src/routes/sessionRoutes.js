import { Router } from "express";
import {
  attendance,
  cancel,
  create,
  list,
  markAttendance,
  update,
} from "../controllers/sessionController.js";
import {
  bulkAttendanceBody,
  createSessionBody,
  listSessionsQuery,
  updateSessionBody,
} from "../validators/sessionValidators.js";
import { idParams } from "../validators/common.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/", validate({ query: listSessionsQuery }), list);
router.post("/", validate({ body: createSessionBody }), create);
router.patch("/:id", validate({ params: idParams, body: updateSessionBody }), update);
router.post("/:id/cancel", validate({ params: idParams }), cancel);
router.get("/:id/attendance", validate({ params: idParams }), attendance);
router.put(
  "/:id/attendance",
  validate({ params: idParams, body: bulkAttendanceBody }),
  markAttendance,
);

export default router;
