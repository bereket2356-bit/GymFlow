import { Router } from "express";
import { list } from "../controllers/auditController.js";
import { listAuditQuery } from "../validators/auditValidators.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/", validate({ query: listAuditQuery }), list);

export default router;
