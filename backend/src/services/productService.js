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

function buildStockTierClause(stockTier) {
  if (stockTier === 'out') return `AND stock_quantity <= 0`;
  if (stockTier === 'low') return `AND stock_quantity > 0 AND stock_quantity < 5`;
  if (stockTier === 'good') return `AND stock_quantity > 5`;
  return '';
}

export async function listProducts({
  search = '',
  brand = '',
  condition = '',
  stockTier = '',
} = {}) {
  const brandClause = brand ? `AND brand = $3` : '';
  const conditionClause =
    condition === 'filled'
      ? `AND status = 'Filled Tank'`
      : condition === 'empty'
        ? `AND status = 'Empty Cylinder'`
        : '';
  const stockClause = buildStockTierClause(stockTier);

  const params = [search, `%${search}%`];
  if (brand) params.push(brand);

  const result = await query(
    `SELECT product_id, brand, weight_class, status, stock_quantity,
            health_indicator, regular_retail, wholesale_price,
            created_at, updated_at
     FROM lpg_products
     WHERE ($1 = '' OR brand ILIKE $2 OR CAST(weight_class AS text) ILIKE $2 OR status ILIKE $2)
       ${brandClause}
       ${conditionClause}
       ${stockClause}
     ORDER BY brand ASC,
       weight_class ASC,
       CASE WHEN status = 'Filled Tank' THEN 0 ELSE 1 END`,
    params
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
       regular_retail, wholesale_price, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
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

export async function deleteProduct(productId) {
  const salesCheck = await query(
    `SELECT COUNT(*)::int AS count FROM sales_records WHERE product_id = $1`,
    [productId]
  );
  if (salesCheck.rows[0].count > 0) {
    throw new AppError('Cannot delete product with existing sales records', 400);
  }

  const result = await query(
    `DELETE FROM lpg_products WHERE product_id = $1 RETURNING *`,
    [productId]
  );
  if (!result.rows[0]) throw new AppError('Product not found', 404);
  return result.rows[0];
}

export async function adjustStock(productId, delta, client) {
  const runner = client ? client.query.bind(client) : query;
  const product = await getProductById(productId, client);
  if (!product) throw new AppError('Product not found', 404);

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
     WHERE health_indicator IN ('Low Stock', 'Out of Stock')
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
     FROM lpg_products`
  );
  return result.rows[0];
}
