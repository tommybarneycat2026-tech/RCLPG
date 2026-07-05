import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, requireAdministrator } from "../middleware/auth.js";
import * as dashboardController from "../controllers/dashboardController.js";

const router = Router();

router.use(authenticate);

// General dashboard metrics (top summary cards, low stock reminder) are
// visible to every authenticated user. The Sales Report, its exports, and
// the legacy generic export are admin-only — staff never see this data.
router.get("/metrics", dashboardController.getMetrics);
router.get(
  "/sales-report",
  requireAdministrator,
  ...dashboardController.getSalesReport,
  validate,
);
router.get(
  "/daily-metrics",
  requireAdministrator,
  ...dashboardController.getDailyMetrics,
  validate,
);
router.get(
  "/export",
  requireAdministrator,
  ...dashboardController.exportReport,
  validate,
);
router.get(
  "/download-sales-report",
  requireAdministrator,
  ...dashboardController.downloadSalesReport,
  validate,
);
router.get(
  "/download-sales-log",
  requireAdministrator,
  ...dashboardController.downloadSalesLog,
  validate,
);

export default router;
