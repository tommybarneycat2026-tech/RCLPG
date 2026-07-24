import pool, { query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

export const PAYMENT_OPTIONS = ['Fully Paid', 'Credit'];

export async function getPaymentHistory(saleId) {
  const result = await query(
    `SELECT credit_id, sales_id, payment_option, balance_paid, date_paid
     FROM credit_history
     WHERE sales_id = $1
     ORDER BY date_paid ASC`,
    [saleId]
  );
  return result.rows;
}

export async function getTotalPaid(saleId, client = null) {
  const runner = client ? client.query.bind(client) : query;
  const result = await runner(
    `SELECT COALESCE(SUM(balance_paid), 0)::numeric AS total_paid
     FROM credit_history
     WHERE sales_id = $1`,
    [saleId]
  );
  return Number(result.rows[0].total_paid);
}

export async function getRemainingCredit(saleId, saleTotal, client = null) {
  const totalPaid = await getTotalPaid(saleId, client);
  return Number((Number(saleTotal) - totalPaid).toFixed(2));
}

export async function createPaymentRecord(
  { saleId, paymentOption, balancePaid },
  client = null
) {
  const runner = client ? client.query.bind(client) : query;
  const result = await runner(
    `INSERT INTO credit_history (sales_id, payment_option, balance_paid)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [saleId, paymentOption, balancePaid]
  );
  return result.rows[0];
}

export async function createInitialCreditRecord(
  { saleId, paymentMethod, totalAmount, initialPayment = 0 },
  client
) {
  if (paymentMethod === 'Fully Paid') {
    return createPaymentRecord(
      { saleId, paymentOption: 'Fully Paid', balancePaid: totalAmount },
      client
    );
  }

  const paid = Number(initialPayment) || 0;

  if (paid < 0) {
    throw new AppError('Initial payment cannot be negative', 400);
  }

  if (paid > totalAmount) {
    throw new AppError('Initial payment cannot exceed sale total', 400);
  }

  return createPaymentRecord(
  {
    saleId,
    paymentOption: 'Credit',
    balancePaid: paid,
  },
  client
);

  return null;
}

export async function createInstallmentPayment(saleId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saleResult = await client.query(
      `SELECT sale_id, total_amount, status FROM sales_records WHERE sale_id = $1`,
      [saleId]
    );
    const sale = saleResult.rows[0];
    if (!sale) throw new AppError('Sale not found', 404);
    if (['Dropped', 'Archived'].includes(sale.status)) {
      throw new AppError('Cannot add payment to inactive sale', 400);
    }

    const paid = Number(amount);
    if (!paid || paid <= 0) throw new AppError('Payment amount must be greater than zero', 400);

    const remaining = await getRemainingCredit(saleId, sale.total_amount, client);
    if (remaining <= 0) throw new AppError('This sale is already fully paid', 400);
    if (paid > remaining) {
      throw new AppError(`Payment exceeds remaining balance of ${remaining.toFixed(2)}`, 400);
    }

    const record = await createPaymentRecord(
      { saleId, paymentOption: 'Credit', balancePaid: paid },
      client
    );

    await client.query('COMMIT');
    return {
      record,
      totalPaid: await getTotalPaid(saleId),
      remainingCredit: await getRemainingCredit(saleId, sale.total_amount),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePaymentRecord(creditId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const creditResult = await client.query(
      `SELECT credit_id, sales_id, balance_paid, payment_option, date_paid FROM credit_history WHERE credit_id = $1`,
      [creditId]
    );
    const credit = creditResult.rows[0];
    if (!credit) throw new AppError('Payment record not found', 404);

    const paid = Number(amount);
    if (!Number.isFinite(paid) || paid < 0) {
      throw new AppError('Payment amount cannot be negative', 400);
    }
    if (paid <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    const saleResult = await client.query(
      `SELECT sale_id, total_amount, status FROM sales_records WHERE sale_id = $1`,
      [credit.sales_id]
    );
    const sale = saleResult.rows[0];
    if (!sale) throw new AppError('Sale not found', 404);
    if (['Dropped', 'Archived'].includes(sale.status)) {
      throw new AppError('Cannot update payment for inactive sale', 400);
    }

    const totalPaid = await getTotalPaid(credit.sales_id, client);
    const remaining = Number((Number(sale.total_amount) - totalPaid + Number(credit.balance_paid)).toFixed(2));
    if (paid > remaining) {
      throw new AppError(`Payment exceeds remaining balance of ${remaining.toFixed(2)}`, 400);
    }

    const updated = await client.query(
      `UPDATE credit_history
       SET balance_paid = $2,
           date_paid = NOW()
       WHERE credit_id = $1
       RETURNING credit_id, sales_id, payment_option, balance_paid, date_paid`,
      [creditId, paid]
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deletePaymentRecord(creditId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const creditResult = await client.query(
      `SELECT credit_id, sales_id FROM credit_history WHERE credit_id = $1`,
      [creditId]
    );
    const credit = creditResult.rows[0];
    if (!credit) throw new AppError('Payment record not found', 404);

    await client.query(`DELETE FROM credit_history WHERE credit_id = $1`, [creditId]);

    await client.query('COMMIT');
    return { creditId, deleted: true, saleId: credit.sales_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function sortCreditRegisterRows(rows) {
  return [...rows].sort((left, right) => {
    const leftIsPaid = String(left.credit_status || '').toLowerCase() === 'paid';
    const rightIsPaid = String(right.credit_status || '').toLowerCase() === 'paid';

    if (leftIsPaid !== rightIsPaid) {
      return leftIsPaid ? 1 : -1;
    }

    const leftDate = Date.parse(left.date_created || 0);
    const rightDate = Date.parse(right.date_created || 0);

    if (Number.isNaN(leftDate) || Number.isNaN(rightDate)) {
      return 0;
    }

    return rightDate - leftDate;
  });
}

export async function getCreditRegister() {
  const result = await query(
    `SELECT
       sr.sale_id,
       sr.total_amount,
       sr.sale_quantity,
       sr.price_type,
       sr.date_created,
       c.customer_id,
       c.name AS customer_name,
       c.phone_number,
       p.brand,
       p.weight_class,
       p.status AS product_status,
       COALESCE(pay.total_paid, 0)::numeric AS total_paid,
       (sr.total_amount - COALESCE(pay.total_paid, 0))::numeric AS remaining_credit,
       CASE
         WHEN (sr.total_amount - COALESCE(pay.total_paid, 0)) <= 0 THEN 'Paid'
         ELSE 'Not Paid'
       END AS credit_status
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     INNER JOIN (
       SELECT sales_id
       FROM credit_history
       WHERE payment_option = 'Credit'
       GROUP BY sales_id
     ) credit_sales ON credit_sales.sales_id = sr.sale_id
     LEFT JOIN (
       SELECT sales_id, SUM(balance_paid) AS total_paid
       FROM credit_history
       GROUP BY sales_id
     ) pay ON pay.sales_id = sr.sale_id
     WHERE sr.status IN ('Active', 'Finished')`
  );

  return sortCreditRegisterRows(result.rows).map((row) => ({
    ...row,
    total_paid: Number(row.total_paid),
    total_amount: Number(row.total_amount),
    remaining_credit: Number(row.remaining_credit),
    product_details: `${row.brand} - ${row.weight_class}kg - ${row.product_status}`,
  }));
}

export async function getCreditSummary(saleId) {
  const result = await query(
    `SELECT
       sr.sale_id,
       sr.total_amount,
       sr.date_created,
       c.name AS customer_name,
       c.phone_number,
       p.brand,
       p.weight_class,
       p.status AS product_status
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.sale_id = $1`,
    [saleId]
  );

  const sale = result.rows[0];
  if (!sale) throw new AppError('Sale not found', 404);

  const totalPaid = await getTotalPaid(saleId);
  const remainingCredit = await getRemainingCredit(saleId, sale.total_amount);
  const history = await getPaymentHistory(saleId);

  return {
    sale_id: sale.sale_id,
    customer_name: sale.customer_name,
    phone_number: sale.phone_number,
    product_details: `${sale.brand} - ${sale.weight_class}kg - ${sale.product_status}`,
    total_cost: Number(sale.total_amount),
    total_paid: totalPaid,
    remaining_credit: remainingCredit,
    credit_status: remainingCredit <= 0 ? 'Paid' : 'Not Paid',
    payment_history: history.map((h) => ({
      ...h,
      balance_paid: Number(h.balance_paid),
    })),
  };
}

export async function deleteCreditHistoryForSale(saleId, client) {
  const runner = client.query.bind(client);
  await runner(`DELETE FROM credit_history WHERE sales_id = $1`, [saleId]);
}
