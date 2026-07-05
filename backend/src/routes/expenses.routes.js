import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate, requireAdministrator } from "../middleware/auth.js";
import * as expenseController from "../controllers/expenseController.js";

const router = Router();

router.use(authenticate);

// Any authenticated user (staff or admin) may log a new expense and view
// the list. Editing/removing an existing expense is admin-only.
router.get("/", ...expenseController.listExpenses, validate);
router.get("/categories", expenseController.getExpenseCategories);
router.post("/", ...expenseController.createExpense, validate);
router.put(
  "/:expensesId",
  requireAdministrator,
  ...expenseController.updateExpense,
  validate,
);
router.delete(
  "/:expensesId",
  requireAdministrator,
  ...expenseController.deleteExpense,
  validate,
);

export default router;
