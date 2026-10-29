import { Router } from "express";
import {
  activate,
  create,
  deactivate,
  detail,
  list,
  remove,
  update,
} from "../controllers/packageController.js";
import {
  createPackageBody,
  listPackagesQuery,
  packageStatusBody,
  updatePackageBody,
} from "../validators/packageValidators.js";
import { idParams } from "../validators/common.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/", validate({ query: listPackagesQuery }), list);
router.post("/", validate({ body: createPackageBody }), create);
router.get("/:id", validate({ params: idParams }), detail);
router.patch("/:id", validate({ params: idParams, body: updatePackageBody }), update);
router.post("/:id/activate", validate({ params: idParams, body: packageStatusBody }), activate);
router.post("/:id/deactivate", validate({ params: idParams, body: packageStatusBody }), deactivate);
router.delete("/:id", validate({ params: idParams }), remove);

export default router;
