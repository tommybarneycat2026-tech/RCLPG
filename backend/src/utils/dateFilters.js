import {
  SQL_TODAY,
  SQL_WEEK_START,
  SQL_MONTH_START,
  SQL_YEAR_START,
  getManilaYear,
  sqlManilaDate,
} from "./timezone.js";

function normalizeDateValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function buildReportDateFilter(quickFilter, startDate, endDate, dateColumn = 'sr.date_created') {
  const clauses = [];
  const params = [];
  let idx = 1;

  const manilaDate = sqlManilaDate(dateColumn);
  const columnExpr = dateColumn === 'e.date' ? 'e.date' : manilaDate;
  const normalizedStartDate = normalizeDateValue(startDate);
  const normalizedEndDate = normalizeDateValue(endDate);

  const addRangeClause = (startExpr, endExpr) => {
    clauses.push(`${columnExpr} BETWEEN ${startExpr} AND ${endExpr}`);
  };

  if (quickFilter === 'today') {
    addRangeClause(SQL_TODAY, SQL_TODAY);
  } else if (quickFilter === 'week') {
    addRangeClause(
      `DATE_TRUNC('week', ${SQL_TODAY}::timestamp)::date`,
      `(DATE_TRUNC('week', ${SQL_TODAY}::timestamp) + INTERVAL '6 days')::date`,
    );
  } else if (quickFilter === 'month') {
    addRangeClause(
      `DATE_TRUNC('month', ${SQL_TODAY}::timestamp)::date`,
      `(DATE_TRUNC('month', ${SQL_TODAY}::timestamp) + INTERVAL '1 month - 1 day')::date`,
    );
  } else if (quickFilter === 'year') {
    addRangeClause(
      `DATE_TRUNC('year', ${SQL_TODAY}::timestamp)::date`,
      `(DATE_TRUNC('year', ${SQL_TODAY}::timestamp) + INTERVAL '1 year - 1 day')::date`,
    );
  } else if (quickFilter === 'first_half') {
    const yearStart = getManilaYear();
    addRangeClause(`'${yearStart}-01-01'`, `'${yearStart}-06-30'`);
  } else if (quickFilter === 'second_half') {
    const yearStart = getManilaYear();
    addRangeClause(`'${yearStart}-07-01'`, `'${yearStart}-12-31'`);
  } else if (normalizedStartDate && normalizedEndDate) {
    clauses.push(`${columnExpr} BETWEEN $${idx++}::date AND $${idx++}::date`);
    params.push(normalizedStartDate, normalizedEndDate);
  }

  return {
    where: clauses.length ? `AND ${clauses.join(' AND ')}` : '',
    params,
    nextIdx: idx,
  };
}

export function buildExportDateFilter(period, startDate, endDate, dateColumn = 'sr.date_created') {
  const clauses = [];
  const params = [];
  let idx = 1;

  const manilaDate = sqlManilaDate(dateColumn);
  const columnExpr = dateColumn === 'e.date' ? 'e.date' : manilaDate;
  const normalizedStartDate = normalizeDateValue(startDate);
  const normalizedEndDate = normalizeDateValue(endDate);

  const addRangeClause = (startExpr, endExpr) => {
    clauses.push(`${columnExpr} BETWEEN ${startExpr} AND ${endExpr}`);
  };

  if (period === 'today' || period === 'current_day') {
    addRangeClause(SQL_TODAY, SQL_TODAY);
  } else if (period === 'daily' && normalizedStartDate) {
    clauses.push(`${columnExpr} = $${idx++}::date`);
    params.push(normalizedStartDate);
  } else if (period === 'monthly' || period === 'month') {
    if (normalizedStartDate) {
      clauses.push(`DATE_TRUNC('month', ${columnExpr}) = DATE_TRUNC('month', $${idx++}::date)`);
      params.push(normalizedStartDate);
    } else {
      addRangeClause(
        `DATE_TRUNC('month', ${SQL_TODAY}::timestamp)::date`,
        `(DATE_TRUNC('month', ${SQL_TODAY}::timestamp) + INTERVAL '1 month - 1 day')::date`,
      );
    }
  } else if (period === 'weekly' || period === 'week') {
    if (normalizedStartDate) {
      addRangeClause(
        `DATE_TRUNC('week', $${idx++}::date)::date`,
        `(DATE_TRUNC('week', $${idx++}::date) + INTERVAL '6 days')::date`,
      );
      params.push(normalizedStartDate, normalizedStartDate);
    } else {
      addRangeClause(
        `DATE_TRUNC('week', ${SQL_TODAY}::timestamp)::date`,
        `(DATE_TRUNC('week', ${SQL_TODAY}::timestamp) + INTERVAL '6 days')::date`,
      );
    }
  } else if (period === 'yearly' || period === 'year') {
    if (normalizedStartDate) {
      clauses.push(`DATE_TRUNC('year', ${columnExpr}) = DATE_TRUNC('year', $${idx++}::date)`);
      params.push(normalizedStartDate);
    } else {
      addRangeClause(
        `DATE_TRUNC('year', ${SQL_TODAY}::timestamp)::date`,
        `(DATE_TRUNC('year', ${SQL_TODAY}::timestamp) + INTERVAL '1 year - 1 day')::date`,
      );
    }
  } else if ((period === 'first_half' || period === 'second_half')) {
    const year = normalizedStartDate ? new Date(`${normalizedStartDate}T12:00:00`).getFullYear() : getManilaYear();
    if (period === 'first_half') {
      addRangeClause(`'${year}-01-01'`, `'${year}-06-30'`);
    } else {
      addRangeClause(`'${year}-07-01'`, `'${year}-12-31'`);
    }
  } else if (period === 'yearly' && normalizedStartDate) {
    clauses.push(`DATE_TRUNC('year', ${columnExpr}) = DATE_TRUNC('year', $${idx++}::date)`);
    params.push(normalizedStartDate);
  } else if (period === 'custom' && normalizedStartDate && normalizedEndDate) {
    clauses.push(`${columnExpr} BETWEEN $${idx++}::date AND $${idx++}::date`);
    params.push(normalizedStartDate, normalizedEndDate);
  }

  return { where: clauses.length ? `AND ${clauses.join(' AND ')}` : '', params, nextIdx: idx };
}
