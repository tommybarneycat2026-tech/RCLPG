import { query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { computeHealthIndicator } from '../utils/constants.js';

async function generateProductId() {
  const result = await query(
    `SELECT product_id FROM lpg_products ORDER BY product_id DESC LIMIT 1`
  );
  const last = result.rows[0]?.product_id;
  const nextNum = last ? parseInt(last, 10) + 1 : 1;
  return String(nextNum).padStart(6, '0');
}

export async function listProducts({ search = '', archived = false } = {}) {
  const result = await query(
    `SELECT product_id, brand, weight_class, status, stock_quantity,
            health_indicator, regular_retail, wholesale_price,
            is_archived, created_at, updated_at
     FROM lpg_products
     WHERE is_archived = $1
       AND ($2 = '' OR brand ILIKE $3 OR CAST(weight_class AS text) ILIKE $3 OR status ILIKE $3)
     ORDER BY weight_class ASC,
       CASE WHEN status = 'Filled Tank' THEN 0 ELSE 1 END,
       brand ASC`,
    [archived, search, `%${search}%`]
  );
  return result.rows;
}

export async function getProductById(productId, client = null) {
  const runner = client ? client.query.bind(client) : query;
  const result = await runner(
    `SELECT * FROM lpg_products WHERE product_id = $1`,
    [productId]
  );
  return result.rows[0] || null;
}

export async function createProduct(data) {
  const health = computeHealthIndicator(data.stockQuantity);
  const productId = await generateProductId();

  const result = await query(
    `INSERT INTO lpg_products
      (product_id, brand, weight_class, status, stock_quantity, health_indicator,
       regular_retail, wholesale_price, is_archived, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW())
     RETURNING *`,
    [
      productId,
      data.brand,
      data.weightClass,
      data.status,
      data.stockQuantity,
      health,
      data.regularRetail,
      data.wholesalePrice,
    ]
  );
  return result.rows[0];
}

export async function updateProduct(productId, data) {
  const existing = await getProductById(productId);
  if (!existing) throw new AppError('Product not found', 404);

  const stockQuantity = data.stockQuantity ?? existing.stock_quantity;
  const health = computeHealthIndicator(stockQuantity);

  const result = await query(
    `UPDATE lpg_products
     SET brand = COALESCE($2, brand),
         weight_class = COALESCE($3, weight_class),
         status = COALESCE($4, status),
         stock_quantity = $5,
         health_indicator = $6,
         regular_retail = COALESCE($7, regular_retail),
         wholesale_price = COALESCE($8, wholesale_price),
         updated_at = NOW()
     WHERE product_id = $1
     RETURNING *`,
    [
      productId,
      data.brand,
      data.weightClass,
      data.status,
      stockQuantity,
      health,
      data.regularRetail,
      data.wholesalePrice,
    ]
  );
  return result.rows[0];
}

export async function archiveProduct(productId) {
  const result = await query(
    `UPDATE lpg_products SET is_archived = true, updated_at = NOW()
     WHERE product_id = $1 AND is_archived = false
     RETURNING *`,
    [productId]
  );
  if (!result.rows[0]) throw new AppError('Product not found or already archived', 404);
  return result.rows[0];
}

export async function adjustStock(productId, delta, client) {
  const runner = client ? client.query.bind(client) : query;
  const product = await getProductById(productId, client);
  if (!product) throw new AppError('Product not found', 404);
  if (product.is_archived) throw new AppError('Cannot adjust archived product stock', 400);

  const newStock = Math.max(0, product.stock_quantity + delta);
  const health = computeHealthIndicator(newStock);

  const result = await runner(
    `UPDATE lpg_products
     SET stock_quantity = $2, health_indicator = $3, updated_at = NOW()
     WHERE product_id = $1
     RETURNING *`,
    [productId, newStock, health]
  );
  return result.rows[0];
}

export async function getWeeklyStockSummary() {
  const result = await query(
    `SELECT weight_class,
            SUM(CASE WHEN status = 'Filled Tank' THEN stock_quantity ELSE 0 END)::int AS filled_stock,
            SUM(CASE WHEN status = 'Empty Cylinder' THEN stock_quantity ELSE 0 END)::int AS empty_stock
     FROM lpg_products
     WHERE is_archived = false
     GROUP BY weight_class
     ORDER BY weight_class ASC`
  );
  return result.rows.map((row) => ({
    weight_class: row.weight_class,
    filled_stock: row.filled_stock,
    empty_stock: row.empty_stock,
    combined_volume: row.filled_stock + row.empty_stock,
  }));
}

export async function getLowStockProducts() {
  const result = await query(
    `SELECT product_id, brand, weight_class, status, stock_quantity, health_indicator
     FROM lpg_products
     WHERE is_archived = false
       AND health_indicator IN ('Low Stock', 'Out of Stock')
     ORDER BY
       CASE health_indicator WHEN 'Out of Stock' THEN 0 ELSE 1 END,
       weight_class ASC,
       brand ASC`
  );
  return result.rows;
}

export async function getInventoryMetrics() {
  const result = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'Filled Tank' THEN stock_quantity ELSE 0 END), 0)::int AS total_filled,
       COALESCE(SUM(CASE WHEN status = 'Empty Cylinder' THEN stock_quantity ELSE 0 END), 0)::int AS total_empty
     FROM lpg_products
     WHERE is_archived = false`
  );
  return result.rows[0];
}
