import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, requireAdministrator } from "../middleware/auth.js";
import * as salesController from "../controllers/salesController.js";

const router = Router();

router.use(authenticate);

// Listing, creating, and updating sales remain available to any
// authenticated user (staff record/override sales as part of daily
// operations). Deleting a sale permanently removes financial history and
// is restricted to administrators.
router.get("/", ...salesController.listSales, validate);
router.post("/", ...salesController.createSale, validate);
router.put("/:saleId", ...salesController.updateSale, validate);
router.delete(
  "/:saleId",
  requireAdministrator,
  ...salesController.deleteSale,
  validate,
);

export default router;
