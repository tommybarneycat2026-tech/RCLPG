import pool, { query } from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureBrand } from "./brandService.js";
import {
  buildReportDateFilter,
  buildExportDateFilter,
} from "../utils/dateFilters.js";
import * as productService from "./productService.js";
import * as customerService from "./customerService.js";
import * as creditService from "./creditService.js";
import * as expenseService from "./expenseService.js";

function buildDateFilter(period, startDate, endDate) {
  return buildExportDateFilter(period, startDate, endDate, "sr.date_created");
}

export async function listSales({
  search = "",
  page = 1,
  limit = 10,
  todayOnly = false,
  period,
  startDate,
  endDate,
  customerName = "",
  productFilter = "",
  dateFilter = "",
} = {}) {
  const offset = (page - 1) * limit;
  const statusFilter = "('Active', 'Finished')";

  let dateClause = "";
  const params = [search, `%${search}%`];
  let idx = 3;

  if (todayOnly) {
    dateClause = `AND DATE(sr.date_created AT TIME ZONE 'UTC') = CURRENT_DATE`;
  } else if (period) {
    const filter = buildDateFilter(period, startDate, endDate);
    dateClause = filter.where;
    params.push(...filter.params);
    idx = filter.nextIdx;
  } else if (dateFilter) {
    dateClause = `AND DATE(sr.date_created) = $${idx++}`;
    params.push(dateFilter);
  }

  let customerClause = "";
  if (customerName) {
    customerClause = `AND c.name ILIKE $${idx++}`;
    params.push(`%${customerName}%`);
  }

  let productClause = "";
  if (productFilter) {
    productClause = `AND (p.brand ILIKE $${idx} OR CAST(p.weight_class AS text) ILIKE $${idx} OR p.status ILIKE $${idx})`;
    params.push(`%${productFilter}%`);
    idx += 1;
  }

  const baseWhere = `
     WHERE sr.status IN ${statusFilter}
       AND ($1 = '' OR c.name ILIKE $2 OR c.fb_name ILIKE $2 OR c.phone_number ILIKE $2
            OR p.brand ILIKE $2 OR CAST(p.weight_class AS text) ILIKE $2 OR p.status ILIKE $2)
       ${dateClause}
       ${customerClause}
       ${productClause}`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     ${baseWhere}`,
    params,
  );

  const dataResult = await query(
    `SELECT sr.sale_id, sr.customer_id, sr.product_id, sr.status, sr.sale_quantity,
            sr.price_type, sr.unit_price, sr.total_amount, sr.lpg_tank_variant,
            sr.date_created, sr.date_updated,
            c.name AS customer_name, c.fb_name, c.phone_number,
            p.brand, p.weight_class, p.status AS product_status
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     ${baseWhere}
     ORDER BY sr.date_created DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
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

export async function getSaleById(saleId) {
  const result = await query(
    `SELECT sr.*, c.name AS customer_name, c.fb_name, c.phone_number,
            p.brand, p.weight_class, p.status AS product_status
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.sale_id = $1`,
    [saleId],
  );
  return result.rows[0] || null;
}

// Applies the inventory effect of a sale for the given product/quantity and
// returns the lpg_tank_variant that should be stored on the sales record.
//
// - Filled Tank products are sold as an exchange: the customer must trade
//   in an empty cylinder (lpgTankVariant), which is swapped into stock.
// - Empty Cylinder products are sold directly (e.g. a brand-new/standalone
//   cylinder) with no trade-in swap, so lpgTankVariant does not apply and
//   the resolved variant is null.
async function applySaleStockEffect(
  { productId, quantity, lpgTankVariant, purchaseTank = false },
  client,
) {
  const product = await productService.getProductById(productId, client);
  if (!product) {
    throw new AppError("Selected product is unavailable", 400);
  }

  if (product.status === "Filled Tank") {
    if (purchaseTank) {
      if (quantity > product.stock_quantity) {
        throw new AppError(
          `Insufficient stock. Available: ${product.stock_quantity}, requested: ${quantity}`,
          400,
        );
      }
      await productService.adjustStock(productId, -quantity, client);
      return null;
    }

    if (!lpgTankVariant) {
      throw new AppError("Customer LPG tank brand is required", 400);
    }

    const resolvedVariant = await ensureBrand(lpgTankVariant);
    await productService.executeTankSwap(
      { filledProductId: productId, emptyBrand: resolvedVariant, quantity },
      client,
    );
    return resolvedVariant;
  }

  if (product.status === "Empty Cylinder") {
    if (quantity > product.stock_quantity) {
      throw new AppError(
        `Insufficient stock. Available: ${product.stock_quantity}, requested: ${quantity}`,
        400,
      );
    }
    await productService.adjustStock(productId, -quantity, client);
    return null;
  }

  throw new AppError("Selected product has an invalid status", 400);
}

// Reverses whatever inventory effect a previously-saved sale had, using the
// same rule deleteSale already relied on: a swap sale restores via
// reverseTankSwap, a direct sale simply restores the deducted stock.
async function reverseSaleStockEffect(existingSale, client) {
  if (existingSale.lpg_tank_variant) {
    await productService.reverseTankSwap(
      {
        filledProductId: existingSale.product_id,
        emptyBrand: existingSale.lpg_tank_variant,
        quantity: existingSale.sale_quantity,
      },
      client,
    );
  } else {
    await productService.adjustStock(
      existingSale.product_id,
      existingSale.sale_quantity,
      client,
    );
  }
}

export async function createSale(payload) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const customer = await customerService.findOrCreateCustomer({
      customerId: payload.customerId,
      name: payload.customerName,
      fbName: payload.fbName,
      phoneNumber: payload.phoneNumber,
    });

    const totalAmount = Number(
      (payload.quantity * payload.unitPrice).toFixed(2),
    );
    const paymentMethod = payload.paymentMethod || "Fully Paid";

    const lpgTankVariant = await applySaleStockEffect(
      {
        productId: payload.productId,
        quantity: payload.quantity,
        lpgTankVariant: payload.lpgTankVariant,
        purchaseTank: payload.purchaseTank,
      },
      client,
    );

    const saleResult = await client.query(
      `INSERT INTO sales_records
        (customer_id, product_id, status, sale_quantity, price_type, unit_price, total_amount, lpg_tank_variant)
       VALUES ($1, $2, 'Active', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        customer.customer_id,
        payload.productId,
        payload.quantity,
        payload.priceType,
        payload.unitPrice,
        totalAmount,
        lpgTankVariant,
      ],
    );

    const saleId = saleResult.rows[0].sale_id;

    await creditService.createInitialCreditRecord(
      {
        saleId,
        paymentMethod,
        totalAmount,
        initialPayment: payload.initialPayment,
      },
      client,
    );

    await client.query("COMMIT");
    return getSaleById(saleId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateSale(saleId, payload) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await getSaleById(saleId);
    if (!existing) throw new AppError("Sale not found", 404);
    if (["Archived", "Dropped"].includes(existing.status)) {
      throw new AppError("Cannot modify deleted sale", 400);
    }

    await customerService.updateCustomer(existing.customer_id, {
      name: payload.customerName,
      fbName: payload.fbName,
      phoneNumber: payload.phoneNumber,
    });

    const stockEffectChanged =
      payload.productId !== existing.product_id ||
      payload.quantity !== existing.sale_quantity ||
      (payload.lpgTankVariant || null) !== (existing.lpg_tank_variant || null);

    let lpgTankVariant = existing.lpg_tank_variant;

    if (stockEffectChanged) {
      await reverseSaleStockEffect(existing, client);
      lpgTankVariant = await applySaleStockEffect(
        {
          productId: payload.productId,
          quantity: payload.quantity,
          lpgTankVariant: payload.lpgTankVariant,
        },
        client,
      );
    }

    const totalAmount = Number(
      (payload.quantity * payload.unitPrice).toFixed(2),
    );

    await client.query(
      `UPDATE sales_records
       SET product_id = $2,
           sale_quantity = $3,
           price_type = $4,
           unit_price = $5,
           total_amount = $6,
           lpg_tank_variant = $7,
           date_updated = NOW()
       WHERE sale_id = $1`,
      [
        saleId,
        payload.productId,
        payload.quantity,
        payload.priceType,
        payload.unitPrice,
        totalAmount,
        lpgTankVariant,
      ],
    );

    await client.query("COMMIT");
    return getSaleById(saleId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteSale(saleId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await getSaleById(saleId);
    if (!existing) throw new AppError("Sale not found", 404);

    await reverseSaleStockEffect(existing, client);

    await creditService.deleteCreditHistoryForSale(saleId, client);
    await client.query(`DELETE FROM sales_records WHERE sale_id = $1`, [
      saleId,
    ]);

    await client.query("COMMIT");
    return { saleId, deleted: true };
  } catch (err) {
    await client.query("ROLLBACK");
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
     WHERE status IN ('Active', 'Finished')`,
  );
  return result.rows[0];
}

// Brand-level sold-units distribution. Accepts the same quickFilter/date
// range as getSalesReport so it responds to the report's active filter
// instead of always reflecting all-time totals.
export async function getBrandSalesMetrics({
  quickFilter = "month",
  startDate,
  endDate,
} = {}) {
  const { where, params } = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "sr.date_created",
  );
  const result = await query(
    `SELECT
       p.brand,
       COALESCE(SUM(sr.sale_quantity), 0)::int AS total_items_sold
     FROM sales_records sr
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.status IN ('Active', 'Finished')
     ${where}
     GROUP BY p.brand
     ORDER BY total_items_sold DESC`,
    params,
  );

  const rows = result.rows;
  const grandTotal = rows.reduce((sum, r) => sum + r.total_items_sold, 0) || 1;

  return rows.map((row) => ({
    brand: row.brand,
    total_items_sold: row.total_items_sold,
    percentage: Number(((row.total_items_sold / grandTotal) * 100).toFixed(1)),
  }));
}

export async function getSalesReport({
  quickFilter = "month",
  startDate,
  endDate,
} = {}) {
  const { where, params } = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "sr.date_created",
  );
  const baseFrom = `
    FROM sales_records sr
    JOIN lpg_products p ON p.product_id = sr.product_id
    WHERE sr.status IN ('Active', 'Finished')
    ${where}`;

  const summaryResult = await query(
    `SELECT
       COALESCE(SUM(sr.total_amount), 0)::numeric AS total_gross_revenue,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS total_cogs,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS total_volume_kg,
       COUNT(*)::int AS total_orders
     ${baseFrom}`,
    params,
  );

  const summary = summaryResult.rows[0];
  const totalRevenue = Number(summary.total_gross_revenue);
  // Cost of Goods Sold (COGS): acquisition cost of every unit sold,
  // sourced from lpg_products.initial_price.
  const costOfGoodsSold = Number(summary.total_cogs);
  const totalOrders = summary.total_orders || 0;
  const totalExpenses = await expenseService.getTotalExpenses({
    quickFilter,
    startDate,
    endDate,
  });
  const grossIncome = totalRevenue;
  // Net Income = Total Sales Revenue − Cost of Goods Sold − Total Expenses
  const netIncome = Number(
    (grossIncome - costOfGoodsSold - totalExpenses).toFixed(2),
  );

  const weightMixResult = await query(
    `SELECT
       p.weight_class,
       COALESCE(SUM(sr.sale_quantity), 0)::int AS units_sold,
       COALESCE(SUM(sr.total_amount), 0)::numeric AS revenue
     ${baseFrom}
     GROUP BY p.weight_class
     ORDER BY p.weight_class ASC`,
    params,
  );

  const totalUnits =
    weightMixResult.rows.reduce((s, r) => s + r.units_sold, 0) || 1;

  const revenueBreakdownResult = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN p.status = 'Filled Tank' THEN sr.total_amount ELSE 0 END), 0)::numeric AS gas_refill_revenue,
       COALESCE(SUM(CASE WHEN p.status = 'Empty Cylinder' THEN sr.total_amount ELSE 0 END), 0)::numeric AS new_cylinder_revenue
     ${baseFrom}`,
    params,
  );

  const customerTypeResult = await query(
    `SELECT
       sr.price_type,
       COUNT(*)::int AS order_count,
       COALESCE(SUM(sr.total_amount), 0)::numeric AS revenue
     ${baseFrom}
     GROUP BY sr.price_type`,
    params,
  );

  const paymentResult = await query(
    `SELECT
       CASE
         WHEN EXISTS (
           SELECT 1 FROM credit_history ch
           WHERE ch.sales_id = sr.sale_id AND ch.payment_option = 'Credit'
         ) THEN 'Invoice / Credit'
         ELSE 'Cash'
       END AS payment_method,
       COUNT(*)::int AS transaction_count,
       COALESCE(SUM(sr.total_amount), 0)::numeric AS revenue
     ${baseFrom}
     GROUP BY 1`,
    params,
  );

  const mapSegments = (rows, totalRev, labelKey) =>
    rows.map((row) => ({
      label: row[labelKey],
      orders: row.order_count ?? row.transaction_count ?? 0,
      revenue: Number(row.revenue),
      percentage:
        totalRev > 0
          ? Number(((Number(row.revenue) / totalRev) * 100).toFixed(1))
          : 0,
    }));

  const customerSegments = mapSegments(
    customerTypeResult.rows.map((r) => ({
      label:
        r.price_type === "Wholesale"
          ? "Commercial Wholesale"
          : "Retail Residential",
      order_count: r.order_count,
      revenue: r.revenue,
    })),
    totalRevenue,
    "label",
  );

  const paymentSegments = paymentResult.rows.map((row) => ({
    label: row.payment_method,
    orders: row.transaction_count,
    revenue: Number(row.revenue),
    percentage:
      totalRevenue > 0
        ? Number(((Number(row.revenue) / totalRevenue) * 100).toFixed(1))
        : 0,
  }));

  const revBreakdown = revenueBreakdownResult.rows[0];
  const gasRefill = Number(revBreakdown.gas_refill_revenue);
  const newCylinder = Number(revBreakdown.new_cylinder_revenue);
  const revTotal = gasRefill + newCylinder || 1;

  const brandMetrics = await getBrandSalesMetrics({
    quickFilter,
    startDate,
    endDate,
  });

  return {
    brandMetrics,
    summary: {
      totalGrossRevenue: totalRevenue,
      grossIncome,
      netIncome,
      totalExpenses,
      costOfGoodsSold,
      totalVolumeKg: Number(summary.total_volume_kg),
      totalOrders,
      averageOrderValue:
        totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0,
      netIncomeFormula:
        "Net Income = Gross Income − Cost of Goods Sold − Total Expenses",
    },
    productMix: weightMixResult.rows.map((row) => ({
      weightClass: Number(row.weight_class),
      unitsSold: row.units_sold,
      revenue: Number(row.revenue),
      percentage: Number(((row.units_sold / totalUnits) * 100).toFixed(1)),
    })),
    revenueBreakdown: {
      gasRefill: {
        revenue: gasRefill,
        percentage: Number(((gasRefill / revTotal) * 100).toFixed(1)),
      },
      newCylinder: {
        revenue: newCylinder,
        percentage: Number(((newCylinder / revTotal) * 100).toFixed(1)),
      },
    },
    customerType: customerSegments,
    fulfillmentMethod: [
      {
        label: "Walk-in Pickup",
        orders: totalOrders,
        revenue: totalRevenue,
        percentage: 100,
      },
      {
        label: "Delivery",
        orders: 0,
        revenue: 0,
        percentage: 0,
      },
    ],
    paymentMethod: paymentSegments,
  };
}

export async function getDailyMetrics({
  quickFilter = "month",
  startDate,
  endDate,
} = {}) {
  const { where, params } = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "sr.date_created",
  );
  const baseFrom = `
    FROM sales_records sr
    JOIN lpg_products p ON p.product_id = sr.product_id
    WHERE sr.status IN ('Active', 'Finished')
    ${where}`;

  const dailyResult = await query(
    `SELECT
       DATE(sr.date_created AT TIME ZONE 'UTC')::date AS date,
       COUNT(*)::int AS orders,
       COALESCE(SUM(sr.total_amount), 0)::numeric AS gross_income,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS cogs,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS volume_kg
     ${baseFrom}
     GROUP BY DATE(sr.date_created AT TIME ZONE 'UTC')
     ORDER BY DATE(sr.date_created AT TIME ZONE 'UTC') ASC`,
    params,
  );

  const expenseByDate = await expenseService.getDailyExpenseTotals({
    quickFilter,
    startDate,
    endDate,
  });
  const expenseMap = new Map(
    expenseByDate.map((row) => [String(row.date), row.totalExpenses]),
  );

  return dailyResult.rows.map((row) => {
    const grossIncome = Number(row.gross_income);
    const costOfGoodsSold = Number(row.cogs);
    const dailyExpenses = expenseMap.get(String(row.date)) || 0;
    return {
      date: row.date,
      orders: row.orders,
      grossIncome,
      costOfGoodsSold,
      volumeKg: Number(row.volume_kg),
      totalExpenses: dailyExpenses,
      netIncome: Number(
        (grossIncome - costOfGoodsSold - dailyExpenses).toFixed(2),
      ),
    };
  });
}

export async function getReportRows(period, startDate, endDate) {
  const { where, params } = buildDateFilter(period, startDate, endDate);
  const result = await query(
    `SELECT sr.sale_id, sr.date_created, sr.status, sr.sale_quantity, sr.price_type,
            sr.unit_price, sr.total_amount, sr.lpg_tank_variant,
            c.name AS customer_name, c.fb_name, c.phone_number,
            p.brand, p.weight_class, p.status AS product_status
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.status IN ('Active', 'Finished', 'Dropped', 'Archived')
       ${where}
     ORDER BY sr.date_created DESC`,
    params,
  );
  return result.rows;
}

function normalizeExportPeriod(period) {
  if (period === "today") return "current_day";
  return period;
}

export async function getSalesReportAnalytics(period, startDate, endDate) {
  const exportPeriod = normalizeExportPeriod(period);
  const { where, params } = buildDateFilter(exportPeriod, startDate, endDate);
  const baseFrom = `
    FROM sales_records sr
    JOIN lpg_products p ON p.product_id = sr.product_id
    WHERE sr.status IN ('Active', 'Finished')
    ${where}`;

  const summaryResult = await query(
    `SELECT
       COALESCE(SUM(sr.total_amount), 0)::numeric AS total_gross_revenue,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS total_cogs,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS total_volume_kg,
       COUNT(*)::int AS total_orders
     ${baseFrom}`,
    params,
  );

  const summary = summaryResult.rows[0];
  const grossIncome = Number(summary.total_gross_revenue);
  const costOfGoodsSold = Number(summary.total_cogs);
  const totalOrders = summary.total_orders || 0;
  const totalVolumeKg = Number(summary.total_volume_kg);
  const totalExpenses = await expenseService.getTotalExpensesForExport(
    exportPeriod,
    startDate,
    endDate,
  );
  // Net Income = Total Sales Revenue − Cost of Goods Sold − Total Expenses
  const netIncome = Number(
    (grossIncome - costOfGoodsSold - totalExpenses).toFixed(2),
  );

  const dailySalesResult = await query(
    `SELECT
       DATE(sr.date_created AT TIME ZONE 'UTC')::date AS date,
       COUNT(*)::int AS orders,
       COALESCE(SUM(sr.total_amount), 0)::numeric AS gross_income,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS cogs,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS volume_kg
     ${baseFrom}
     GROUP BY DATE(sr.date_created AT TIME ZONE 'UTC')
     ORDER BY DATE(sr.date_created AT TIME ZONE 'UTC') ASC`,
    params,
  );

  const expenseByDate = await expenseService.getDailyExpenseTotalsForExport(
    exportPeriod,
    startDate,
    endDate,
  );
  const expenseMap = new Map(
    expenseByDate.map((row) => [String(row.date), row.totalExpenses]),
  );

  const dailyMetrics = dailySalesResult.rows.map((row) => {
    const dayGross = Number(row.gross_income);
    const dayCogs = Number(row.cogs);
    const dayExpenses = expenseMap.get(String(row.date)) || 0;
    return {
      date: row.date,
      orders: row.orders,
      grossIncome: dayGross,
      volumeKg: Number(row.volume_kg),
      totalExpenses: dayExpenses,
      netIncome: Number((dayGross - dayCogs - dayExpenses).toFixed(2)),
    };
  });

  expenseByDate.forEach(({ date, totalExpenses: dayExpenses }) => {
    const key = String(date);
    if (!dailyMetrics.find((d) => String(d.date) === key)) {
      dailyMetrics.push({
        date,
        orders: 0,
        grossIncome: 0,
        volumeKg: 0,
        totalExpenses: dayExpenses,
        netIncome: Number((-dayExpenses).toFixed(2)),
      });
    }
  });

  dailyMetrics.sort((a, b) => new Date(a.date) - new Date(b.date));

  const brandResult = await query(
    `SELECT
       p.brand,
       COALESCE(SUM(sr.sale_quantity), 0)::int AS units_sold
     ${baseFrom}
     GROUP BY p.brand
     ORDER BY units_sold DESC`,
    params,
  );

  const customerTypeResult = await query(
    `SELECT
       CASE WHEN sr.price_type = 'Wholesale' THEN 'Commercial' ELSE 'Retail' END AS customer_type,
       COUNT(*)::int AS order_count
     ${baseFrom}
     GROUP BY 1`,
    params,
  );

  return {
    summary: {
      grossIncome,
      netIncome,
      totalExpenses,
      costOfGoodsSold,
      totalVolumeKg,
      totalOrders,
    },
    dailyMetrics,
    productsByBrand: brandResult.rows.map((row) => ({
      brand: row.brand,
      unitsSold: row.units_sold,
    })),
    customerType: customerTypeResult.rows.map((row) => ({
      label: row.customer_type,
      orders: row.order_count,
    })),
  };
}
