import pool, { query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import * as productService from './productService.js';
import * as customerService from './customerService.js';

function buildDateFilter(period, startDate, endDate) {
  const clauses = [];
  const params = [];
  let idx = 1;

  if (period === 'current_day') {
    clauses.push(`DATE(sr.date_created AT TIME ZONE 'UTC') = CURRENT_DATE`);
  } else if (period === 'daily' && startDate) {
    clauses.push(`DATE(sr.date_created) = $${idx++}`);
    params.push(startDate);
  } else if (period === 'monthly' && startDate) {
    clauses.push(`DATE_TRUNC('month', sr.date_created) = DATE_TRUNC('month', $${idx++}::date)`);
    params.push(startDate);
  } else if (period === 'yearly' && startDate) {
    clauses.push(`DATE_TRUNC('year', sr.date_created) = DATE_TRUNC('year', $${idx++}::date)`);
    params.push(startDate);
  } else if (period === 'custom' && startDate && endDate) {
    clauses.push(`DATE(sr.date_created) BETWEEN $${idx++} AND $${idx++}`);
    params.push(startDate, endDate);
  }

  return { where: clauses.length ? `AND ${clauses.join(' AND ')}` : '', params, nextIdx: idx };
}

export async function listSales({
  search = '',
  archived = false,
  page = 1,
  limit = 10,
  todayOnly = false,
  period,
  startDate,
  endDate,
} = {}) {
  const offset = (page - 1) * limit;
  const statusFilter = archived ? "('Archived', 'Dropped')" : "('Active', 'Finished')";

  let dateClause = '';
  const params = [search, `%${search}%`];
  let idx = 3;

  if (todayOnly) {
    dateClause = `AND DATE(sr.date_created AT TIME ZONE 'UTC') = CURRENT_DATE`;
  } else if (period) {
    const filter = buildDateFilter(period, startDate, endDate);
    dateClause = filter.where;
    params.push(...filter.params);
    idx = filter.nextIdx;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.status IN ${statusFilter}
       AND ($1 = '' OR c.name ILIKE $2 OR c.fb_name ILIKE $2 OR c.phone_number ILIKE $2
            OR p.brand ILIKE $2 OR CAST(p.weight_class AS text) ILIKE $2)
       ${dateClause}`,
    params
  );

  const dataResult = await query(
    `SELECT sr.sale_id, sr.customer_id, sr.product_id, sr.status, sr.sale_quantity,
            sr.price_type, sr.unit_price, sr.total_amount, sr.date_created, sr.date_updated,
            c.name AS customer_name, c.fb_name, c.phone_number,
            p.brand, p.weight_class, p.status AS product_status
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.status IN ${statusFilter}
       AND ($1 = '' OR c.name ILIKE $2 OR c.fb_name ILIKE $2 OR c.phone_number ILIKE $2
            OR p.brand ILIKE $2 OR CAST(p.weight_class AS text) ILIKE $2)
       ${dateClause}
     ORDER BY sr.date_created DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
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

export async function getSaleById(saleId) {
  const result = await query(
    `SELECT sr.*, c.name AS customer_name, c.fb_name, c.phone_number,
            p.brand, p.weight_class, p.status AS product_status
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.sale_id = $1`,
    [saleId]
  );
  return result.rows[0] || null;
}

export async function createSale(payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customer = await customerService.findOrCreateCustomer({
      customerId: payload.customerId,
      name: payload.customerName,
      fbName: payload.fbName,
      phoneNumber: payload.phoneNumber,
    });

    const product = await productService.getProductById(payload.productId, client);
    if (!product || product.is_archived) {
      throw new AppError('Selected product is unavailable', 400);
    }

    if (payload.quantity > product.stock_quantity) {
      throw new AppError(
        `Insufficient stock. Available: ${product.stock_quantity}, requested: ${payload.quantity}`,
        400
      );
    }

    const totalAmount = Number((payload.quantity * payload.unitPrice).toFixed(2));

    const saleResult = await client.query(
      `INSERT INTO sales_records
        (customer_id, product_id, status, sale_quantity, price_type, unit_price, total_amount)
       VALUES ($1, $2, 'Active', $3, $4, $5, $6)
       RETURNING *`,
      [
        customer.customer_id,
        payload.productId,
        payload.quantity,
        payload.priceType,
        payload.unitPrice,
        totalAmount,
      ]
    );

    await productService.adjustStock(payload.productId, -payload.quantity, client);

    await client.query('COMMIT');
    return getSaleById(saleResult.rows[0].sale_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateSale(saleId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await getSaleById(saleId);
    if (!existing) throw new AppError('Sale not found', 404);
    if (['Archived', 'Dropped'].includes(existing.status)) {
      throw new AppError('Cannot modify archived or dropped sale', 400);
    }

    await customerService.updateCustomer(existing.customer_id, {
      name: payload.customerName,
      fbName: payload.fbName,
      phoneNumber: payload.phoneNumber,
    });

    const productChanged = payload.productId !== existing.product_id;
    const qtyChanged = payload.quantity !== existing.sale_quantity;

    if (productChanged || qtyChanged) {
      await productService.adjustStock(existing.product_id, existing.sale_quantity, client);

      const newProduct = await productService.getProductById(payload.productId, client);
      if (!newProduct || newProduct.is_archived) {
        throw new AppError('Selected product is unavailable', 400);
      }
      if (payload.quantity > newProduct.stock_quantity) {
        throw new AppError(
          `Insufficient stock. Available: ${newProduct.stock_quantity}, requested: ${payload.quantity}`,
          400
        );
      }
      await productService.adjustStock(payload.productId, -payload.quantity, client);
    }

    const totalAmount = Number((payload.quantity * payload.unitPrice).toFixed(2));

    await client.query(
      `UPDATE sales_records
       SET product_id = $2,
           sale_quantity = $3,
           price_type = $4,
           unit_price = $5,
           total_amount = $6,
           date_updated = NOW()
       WHERE sale_id = $1`,
      [
        saleId,
        payload.productId,
        payload.quantity,
        payload.priceType,
        payload.unitPrice,
        totalAmount,
      ]
    );

    await client.query('COMMIT');
    return getSaleById(saleId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function dropSale(saleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await getSaleById(saleId);
    if (!existing) throw new AppError('Sale not found', 404);
    if (['Archived', 'Dropped'].includes(existing.status)) {
      throw new AppError('Sale already archived or dropped', 400);
    }

    await productService.adjustStock(existing.product_id, existing.sale_quantity, client);

    await client.query(
      `UPDATE sales_records SET status = 'Dropped', date_updated = NOW() WHERE sale_id = $1`,
      [saleId]
    );

    await client.query('COMMIT');
    return getSaleById(saleId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDashboardSalesMetrics() {
  const result = await query(
    `SELECT
       COALESCE(SUM(sale_quantity), 0)::int AS total_items_sold,
       COALESCE(SUM(total_amount), 0)::numeric AS total_revenue
     FROM sales_records
     WHERE status IN ('Active', 'Finished')`
  );
  return result.rows[0];
}

export async function getReportRows(period, startDate, endDate) {
  const { where, params } = buildDateFilter(period, startDate, endDate);
  const result = await query(
    `SELECT sr.sale_id, sr.date_created, sr.status, sr.sale_quantity, sr.price_type,
            sr.unit_price, sr.total_amount,
            c.name AS customer_name, c.fb_name, c.phone_number,
            p.brand, p.weight_class, p.status AS product_status
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.status IN ('Active', 'Finished', 'Dropped', 'Archived')
       ${where}
     ORDER BY sr.date_created DESC`,
    params
  );
  return result.rows;
}
