import { Router } from "express";
import { requireOwner } from "../middleware/auth.js";
import authRoutes from "./authRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import customerRoutes from "./customerRoutes.js";
import membershipRoutes from "./membershipRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import packageRoutes from "./packageRoutes.js";
import sessionRoutes from "./sessionRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import reportRoutes from "./reportRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import auditRoutes from "./auditRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/dashboard", requireOwner, dashboardRoutes);
router.use("/customers", requireOwner, customerRoutes);
router.use("/memberships", requireOwner, membershipRoutes);
router.use("/payments", requireOwner, paymentRoutes);
router.use("/packages", requireOwner, packageRoutes);
router.use("/sessions", requireOwner, sessionRoutes);
router.use("/expenses", requireOwner, expenseRoutes);
router.use("/reports", requireOwner, reportRoutes);
router.use("/settings", requireOwner, settingsRoutes);
router.use("/audit", requireOwner, auditRoutes);

export default router;
