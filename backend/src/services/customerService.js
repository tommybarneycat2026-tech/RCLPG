import { query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listCustomers(search = '') {
  const result = await query(
    `SELECT customer_id, name, fb_name, phone_number, created_at
     FROM customers
     WHERE ($1 = '' OR name ILIKE $2 OR fb_name ILIKE $2 OR phone_number ILIKE $2)
     ORDER BY name ASC`,
    [search, `%${search}%`]
  );
  return result.rows;
}

export async function getCustomerById(customerId) {
  const result = await query(
    `SELECT customer_id, name, fb_name, phone_number, created_at
     FROM customers WHERE customer_id = $1`,
    [customerId]
  );
  return result.rows[0] || null;
}

export async function createCustomer({ name, fbName, phoneNumber }) {
  const result = await query(
    `INSERT INTO customers (name, fb_name, phone_number)
     VALUES ($1, $2, $3)
     RETURNING customer_id, name, fb_name, phone_number, created_at`,
    [name.trim(), fbName?.trim() || null, phoneNumber?.trim() || null]
  );
  return result.rows[0];
}

export async function updateCustomer(customerId, { name, fbName, phoneNumber }) {
  const result = await query(
    `UPDATE customers
     SET name = $2, fb_name = $3, phone_number = $4
     WHERE customer_id = $1
     RETURNING customer_id, name, fb_name, phone_number, created_at`,
    [customerId, name.trim(), fbName?.trim() || null, phoneNumber?.trim() || null]
  );
  if (!result.rows[0]) throw new AppError('Customer not found', 404);
  return result.rows[0];
}

export async function findOrCreateCustomer({ name, fbName, phoneNumber, customerId }) {
  if (customerId) {
    const existing = await getCustomerById(customerId);
    if (!existing) throw new AppError('Customer not found', 404);
    return existing;
  }
  return createCustomer({ name, fbName, phoneNumber });
}
