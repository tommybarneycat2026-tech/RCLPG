import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, requireAdministrator } from "../middleware/auth.js";
import * as productController from "../controllers/productController.js";

const router = Router();

router.use(authenticate);

// Read access is available to every authenticated user (staff have
// read-only access to the Inventory Catalog). Writes are admin-only.
router.get("/", ...productController.listProducts, validate);
router.post(
  "/",
  requireAdministrator,
  ...productController.createProduct,
  validate,
);
router.put(
  "/:productId",
  requireAdministrator,
  ...productController.updateProduct,
  validate,
);
router.patch(
  "/:productId/archive",
  requireAdministrator,
  ...productController.archiveProduct,
  validate,
);
router.delete(
  "/:productId",
  requireAdministrator,
  ...productController.deleteProduct,
  validate,
);

// Static endpoints
router.get("/summary/weekly", productController.weeklySummary);
router.get("/summary/brands", productController.brandOverview);
router.get("/alerts/low-stock", productController.lowStock);

export default router;
