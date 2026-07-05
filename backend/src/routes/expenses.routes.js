import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import * as expenseController from "../controllers/expenseController.js";

const router = Router();

router.use(authenticate);

router.get("/", ...expenseController.listExpenses, validate);
router.get("/categories", expenseController.getExpenseCategories);
router.post("/", ...expenseController.createExpense, validate);
router.put("/:expensesId", ...expenseController.updateExpense, validate);
router.delete("/:expensesId", ...expenseController.deleteExpense, validate);

export default router;
