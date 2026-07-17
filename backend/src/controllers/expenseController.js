import { body, param, query as q } from "express-validator";
import * as expenseService from "../services/expenseService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { broadcastRealtime } from "../utils/realtime.js";

export const listExpenses = [
  q("todayOnly").optional().isIn(["true", "false"]),
  q("quickFilter").optional().isString(),
  q("startDate").optional().isISO8601(),
  q("endDate").optional().isISO8601(),
  q("page").optional().isInt({ min: 1 }),
  q("limit").optional().isInt({ min: 1, max: 100 }),
  asyncHandler(async (req, res) => {
    const result = await expenseService.listExpenses({
      todayOnly: req.query.todayOnly === "true",
      quickFilter: req.query.quickFilter || "today",
      startDate: req.query.startDate || "",
      endDate: req.query.endDate || "",
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
    });
    res.json({ success: true, ...result });
  }),
];

export const createExpense = [
  body("expenses")
    .trim()
    .notEmpty()
    .withMessage("Expense category is required"),
  body("amount")
    .isFloat({ min: 0 })
    .withMessage("Amount must be a non-negative number"),
  body("date").optional().isISO8601().withMessage("Invalid date format"),
  asyncHandler(async (req, res) => {
    const expense = await expenseService.createExpense({
      expenses: req.body.expenses,
      amount: req.body.amount,
      date: req.body.date,
    });
    broadcastRealtime("expenses:changed", { action: "created", expense });
    res.status(201).json({ success: true, data: expense });
  }),
];

export const updateExpense = [
  param("expensesId").isInt().withMessage("Invalid expense id"),
  body("expenses")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Expense category is required"),
  body("amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount must be a non-negative number"),
  body("date").optional().isISO8601().withMessage("Invalid date format"),
  asyncHandler(async (req, res) => {
    const expense = await expenseService.updateExpense(req.params.expensesId, {
      expenses: req.body.expenses,
      amount: req.body.amount,
      date: req.body.date,
    });
    broadcastRealtime("expenses:changed", { action: "updated", expense });
    res.json({ success: true, data: expense });
  }),
];

export const deleteExpense = [
  param("expensesId").isInt().withMessage("Invalid expense id"),
  asyncHandler(async (req, res) => {
    const expense = await expenseService.deleteExpense(req.params.expensesId);
    broadcastRealtime("expenses:changed", { action: "deleted", expense });
    res.json({ success: true, data: expense });
  }),
];

export const getExpenseCategories = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: expenseService.DEFAULT_EXPENSE_CATEGORIES });
});
