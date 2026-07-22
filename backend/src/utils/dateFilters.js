import {
  SQL_TODAY,
  SQL_WEEK_START,
  SQL_MONTH_START,
  SQL_YEAR_START,
  getManilaYear,
  sqlManilaDate,
} from "./timezone.js";

export function buildReportDateFilter(quickFilter, startDate, endDate, dateColumn = 'sr.date_created') {
  const clauses = [];
  const params = [];
  let idx = 1;

  const manilaDate = sqlManilaDate(dateColumn);

  if (quickFilter === 'today') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date = ${SQL_TODAY}`);
    } else {
      clauses.push(`${manilaDate} = ${SQL_TODAY}`);
    }
  } else if (quickFilter === 'week') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date >= ${SQL_WEEK_START}`);
    } else {
      clauses.push(`${manilaDate} >= ${SQL_WEEK_START}`);
    }
  } else if (quickFilter === 'month') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date >= ${SQL_MONTH_START}`);
    } else {
      clauses.push(`${manilaDate} >= ${SQL_MONTH_START}`);
    }
  } else if (quickFilter === 'year') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date >= ${SQL_YEAR_START}`);
    } else {
      clauses.push(`${manilaDate} >= ${SQL_YEAR_START}`);
    }
  } else if (quickFilter === 'first_half') {
    const yearStart = getManilaYear();
    if (dateColumn === 'e.date') {
      clauses.push(`e.date BETWEEN '${yearStart}-01-01' AND '${yearStart}-06-30'`);
    } else {
      clauses.push(`${manilaDate} BETWEEN '${yearStart}-01-01' AND '${yearStart}-06-30'`);
    }
  } else if (quickFilter === 'second_half') {
    const yearStart = getManilaYear();
    if (dateColumn === 'e.date') {
      clauses.push(`e.date BETWEEN '${yearStart}-07-01' AND '${yearStart}-12-31'`);
    } else {
      clauses.push(`${manilaDate} BETWEEN '${yearStart}-07-01' AND '${yearStart}-12-31'`);
    }
  } else if (startDate && endDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date BETWEEN $${idx++} AND $${idx++}`);
    } else {
      clauses.push(`${manilaDate} BETWEEN $${idx++} AND $${idx++}`);
    }
    params.push(startDate, endDate);
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

  if (period === 'today' || period === 'current_day') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date = ${SQL_TODAY}`);
    } else {
      clauses.push(`${manilaDate} = ${SQL_TODAY}`);
    }
  } else if (period === 'daily' && startDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date = $${idx++}`);
    } else {
      clauses.push(`${manilaDate} = $${idx++}`);
    }
    params.push(startDate);
  } else if (period === 'monthly') {
    if (dateColumn === 'e.date') {
      if (startDate) {
        clauses.push(`DATE_TRUNC('month', e.date) = DATE_TRUNC('month', $${idx++}::date)`);
        params.push(startDate);
      } else {
        clauses.push(`DATE_TRUNC('month', e.date) = DATE_TRUNC('month', CURRENT_DATE)`);
      }
    } else {
      if (startDate) {
        clauses.push(`DATE_TRUNC('month', ${manilaDate}) = DATE_TRUNC('month', $${idx++}::date)`);
        params.push(startDate);
      } else {
        clauses.push(`DATE_TRUNC('month', ${manilaDate}) = DATE_TRUNC('month', CURRENT_DATE)`);
      }
    }
  } else if (period === 'weekly') {
    if (dateColumn === 'e.date') {
      if (startDate) {
        clauses.push(`e.date >= DATE_TRUNC('week', $${idx++}::date)::date`);
        params.push(startDate);
      } else {
        clauses.push(`e.date >= DATE_TRUNC('week', CURRENT_DATE)::date`);
      }
    } else {
      if (startDate) {
        clauses.push(`${manilaDate} >= DATE_TRUNC('week', $${idx++}::date)::date`);
        params.push(startDate);
      } else {
        clauses.push(`${manilaDate} >= DATE_TRUNC('week', CURRENT_DATE)::date`);
      }
    }
  } else if ((period === 'first_half' || period === 'second_half')) {
    const year = startDate ? new Date(`${startDate}T12:00:00`).getFullYear() : getManilaYear();
    if (dateColumn === 'e.date') {
      if (period === 'first_half') {
        clauses.push(`e.date BETWEEN '${year}-01-01' AND '${year}-06-30'`);
      } else {
        clauses.push(`e.date BETWEEN '${year}-07-01' AND '${year}-12-31'`);
      }
    } else if (period === 'first_half') {
      clauses.push(`${manilaDate} BETWEEN '${year}-01-01' AND '${year}-06-30'`);
    } else {
      clauses.push(`${manilaDate} BETWEEN '${year}-07-01' AND '${year}-12-31'`);
    }
  } else if (period === 'yearly' && startDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`DATE_TRUNC('year', e.date) = DATE_TRUNC('year', $${idx++}::date)`);
    } else {
      clauses.push(`DATE_TRUNC('year', ${manilaDate}) = DATE_TRUNC('year', $${idx++}::date)`);
    }
    params.push(startDate);
  } else if (period === 'custom' && startDate && endDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date BETWEEN $${idx++} AND $${idx++}`);
    } else {
      clauses.push(`${manilaDate} BETWEEN $${idx++} AND $${idx++}`);
    }
    params.push(startDate, endDate);
  }

  return { where: clauses.length ? `AND ${clauses.join(' AND ')}` : '', params, nextIdx: idx };
}
