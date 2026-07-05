export function buildReportDateFilter(quickFilter, startDate, endDate, dateColumn = 'sr.date_created') {
  const clauses = [];
  const params = [];
  let idx = 1;

  const dateExpr = dateColumn.includes('.')
    ? dateColumn
    : dateColumn;

  if (quickFilter === 'today') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date = CURRENT_DATE`);
    } else {
      clauses.push(`DATE(${dateExpr} AT TIME ZONE 'UTC') = CURRENT_DATE`);
    }
  } else if (quickFilter === 'week') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date >= DATE_TRUNC('week', CURRENT_DATE)::date`);
    } else {
      clauses.push(`${dateExpr} >= DATE_TRUNC('week', CURRENT_DATE)`);
    }
  } else if (quickFilter === 'month') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date >= DATE_TRUNC('month', CURRENT_DATE)::date`);
    } else {
      clauses.push(`${dateExpr} >= DATE_TRUNC('month', CURRENT_DATE)`);
    }
  } else if (quickFilter === 'year') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date >= DATE_TRUNC('year', CURRENT_DATE)::date`);
    } else {
      clauses.push(`${dateExpr} >= DATE_TRUNC('year', CURRENT_DATE)`);
    }
  } else if (startDate && endDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date BETWEEN $${idx++} AND $${idx++}`);
    } else {
      clauses.push(`DATE(${dateExpr}) BETWEEN $${idx++} AND $${idx++}`);
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

  if (period === 'today' || period === 'current_day') {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date = CURRENT_DATE`);
    } else {
      clauses.push(`DATE(${dateColumn} AT TIME ZONE 'UTC') = CURRENT_DATE`);
    }
  } else if (period === 'daily' && startDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date = $${idx++}`);
    } else {
      clauses.push(`DATE(${dateColumn}) = $${idx++}`);
    }
    params.push(startDate);
  } else if (period === 'monthly' && startDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`DATE_TRUNC('month', e.date) = DATE_TRUNC('month', $${idx++}::date)`);
    } else {
      clauses.push(`DATE_TRUNC('month', ${dateColumn}) = DATE_TRUNC('month', $${idx++}::date)`);
    }
    params.push(startDate);
  } else if (period === 'yearly' && startDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`DATE_TRUNC('year', e.date) = DATE_TRUNC('year', $${idx++}::date)`);
    } else {
      clauses.push(`DATE_TRUNC('year', ${dateColumn}) = DATE_TRUNC('year', $${idx++}::date)`);
    }
    params.push(startDate);
  } else if (period === 'custom' && startDate && endDate) {
    if (dateColumn === 'e.date') {
      clauses.push(`e.date BETWEEN $${idx++} AND $${idx++}`);
    } else {
      clauses.push(`DATE(${dateColumn}) BETWEEN $${idx++} AND $${idx++}`);
    }
    params.push(startDate, endDate);
  }

  return { where: clauses.length ? `AND ${clauses.join(' AND ')}` : '', params, nextIdx: idx };
}
