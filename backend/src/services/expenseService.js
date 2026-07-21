import { query } from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";
import { DEFAULT_EXPENSE_CATEGORIES } from "../utils/constants.js";
import {
  buildReportDateFilter,
  buildExportDateFilter,
} from "../utils/dateFilters.js";
import { SQL_TODAY, getManilaTodayISO } from "../utils/timezone.js";

export { DEFAULT_EXPENSE_CATEGORIES };

export async function createExpense({ expenses, amount, date }) {
  const trimmed = expenses?.trim();
  if (!trimmed) {
    throw new AppError("Expense category is required", 400);
  }
  if (amount == null || Number(amount) < 0) {
    throw new AppError("Amount must be a non-negative number", 400);
  }

  const expenseDate = date || getManilaTodayISO();

  const result = await query(
    `INSERT INTO expenses (expenses, amount, date)
     VALUES ($1, $2, $3)
     RETURNING expenses_id, expenses, amount, date`,
    [trimmed, Number(amount).toFixed(2), expenseDate],
  );

  return result.rows[0];
}

export async function getExpenseById(expensesId) {
  const result = await query(
    `SELECT expenses_id, expenses, amount, date FROM expenses WHERE expenses_id = $1`,
    [expensesId],
  );
  return result.rows[0] || null;
}

export async function updateExpense(expensesId, { expenses, amount, date }) {
  const existing = await getExpenseById(expensesId);
  if (!existing) throw new AppError("Expense not found", 404);

  const trimmed = expenses?.trim();
  if (expenses !== undefined && !trimmed) {
    throw new AppError("Expense category is required", 400);
  }
  if (amount !== undefined && (amount == null || Number(amount) < 0)) {
    throw new AppError("Amount must be a non-negative number", 400);
  }

  const result = await query(
    `UPDATE expenses
     SET expenses = COALESCE($2, expenses),
         amount = COALESCE($3, amount),
         date = COALESCE($4, date)
     WHERE expenses_id = $1
     RETURNING expenses_id, expenses, amount, date`,
    [
      expensesId,
      trimmed ?? null,
      amount != null ? Number(amount).toFixed(2) : null,
      date ?? null,
    ],
  );
  return result.rows[0];
}

export async function deleteExpense(expensesId) {
  const result = await query(
    `DELETE FROM expenses WHERE expenses_id = $1 RETURNING expenses_id, expenses, amount, date`,
    [expensesId],
  );
  if (!result.rows[0]) throw new AppError("Expense not found", 404);
  return result.rows[0];
}

export async function listExpenses({
  todayOnly = false,
  quickFilter = "today",
  startDate = "",
  endDate = "",
  page = 1,
  limit = 10,
} = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  let dateClause = "";

  if (todayOnly) {
    dateClause = `WHERE e.date = ${SQL_TODAY}`;
  } else {
    const { where, params: filterParams } = buildReportDateFilter(
      quickFilter,
      startDate,
      endDate,
      "e.date",
    );
    params.push(...filterParams);
    if (where) {
      dateClause = `WHERE 1=1 ${where}`;
    }
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM expenses e ${dateClause}`,
    params,
  );

  const dataResult = await query(
    `SELECT e.expenses_id, e.expenses, e.amount, e.date
     FROM expenses e
     ${dateClause}
     ORDER BY e.date DESC, e.expenses_id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limit) || 1,
    },
  };
}

export async function getTotalExpenses({
  quickFilter = "month",
  startDate,
  endDate,
} = {}) {
  const { where, params } = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "e.date",
  );
  const result = await query(
    `SELECT COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
     FROM expenses e
     WHERE 1=1 ${where}`,
    params,
  );
  return Number(result.rows[0].total_expenses);
}

export async function getDailyExpenseTotals({
  quickFilter = "month",
  startDate,
  endDate,
} = {}) {
  const { where, params } = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "e.date",
  );
  const result = await query(
    `SELECT e.date, COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
     FROM expenses e
     WHERE 1=1 ${where}
     GROUP BY e.date
     ORDER BY e.date ASC`,
    params,
  );
  return result.rows.map((row) => ({
    date: row.date,
    totalExpenses: Number(row.total_expenses),
  }));
}

export async function getTotalExpensesForExport(period, startDate, endDate) {
  const { where, params } = buildExportDateFilter(
    period,
    startDate,
    endDate,
    "e.date",
  );
  const result = await query(
    `SELECT COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
     FROM expenses e
     WHERE 1=1 ${where}`,
    params,
  );
  return Number(result.rows[0].total_expenses);
}

export async function getDailyExpenseTotalsForExport(
  period,
  startDate,
  endDate,
) {
  const { where, params } = buildExportDateFilter(
    period,
    startDate,
    endDate,
    "e.date",
  );
  const result = await query(
    `SELECT e.date, COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
     FROM expenses e
     WHERE 1=1 ${where}
     GROUP BY e.date
     ORDER BY e.date ASC`,
    params,
  );
  return result.rows.map((row) => ({
    date: row.date,
    totalExpenses: Number(row.total_expenses),
  }));
}
