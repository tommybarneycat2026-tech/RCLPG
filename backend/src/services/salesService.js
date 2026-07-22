import pool, { query } from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureBrand } from "./brandService.js";
import {
  buildReportDateFilter,
  buildExportDateFilter,
} from "../utils/dateFilters.js";
import { SQL_TODAY, sqlManilaDate } from "../utils/timezone.js";
import * as productService from "./productService.js";
import * as customerService from "./customerService.js";
import * as creditService from "./creditService.js";
import * as expenseService from "./expenseService.js";
import { buildSalesReportSummary } from "./reportSummary.js";

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

  const buildDateClause = ({ dateColumn, params, index }) => {
    if (todayOnly) {
      return {
        clause: `AND ${sqlManilaDate(dateColumn)} = ${SQL_TODAY}`,
        params,
        nextIdx: index,
      };
    }

    if (period) {
      const filter = buildDateFilter(period, startDate, endDate, dateColumn);
      params.push(...filter.params);
      return {
        clause: filter.where,
        params,
        nextIdx: filter.nextIdx,
      };
    }

    if (dateFilter) {
      params.push(dateFilter);
      return {
        clause: `AND ${sqlManilaDate(dateColumn)} = $${index}`,
        params,
        nextIdx: index + 1,
      };
    }

    return {
      clause: "",
      params,
      nextIdx: index,
    };
  };

  const salesParams = [search, `%${search}%`];
  let salesIdx = 3;
  const salesDate = buildDateClause({
    dateColumn: "sr.date_created",
    params: salesParams,
    index: salesIdx,
  });
  salesIdx = salesDate.nextIdx;

  let salesCustomerClause = "";
  if (customerName) {
    salesCustomerClause = `AND c.name ILIKE $${salesIdx++}`;
    salesParams.push(`%${customerName}%`);
  }

  let salesProductClause = "";
  if (productFilter) {
    salesProductClause = `AND (p.brand ILIKE $${salesIdx} OR CAST(p.weight_class AS text) ILIKE $${salesIdx} OR p.status ILIKE $${salesIdx})`;
    salesParams.push(`%${productFilter}%`);
    salesIdx += 1;
  }

  const salesBaseWhere = `
     WHERE sr.status IN ${statusFilter}
       AND ($1 = '' OR c.name ILIKE $2 OR c.fb_name ILIKE $2 OR c.phone_number ILIKE $2
            OR p.brand ILIKE $2 OR CAST(p.weight_class AS text) ILIKE $2 OR p.status ILIKE $2)
       ${salesDate.clause}
       ${salesCustomerClause}
       ${salesProductClause}`;

  const paymentParams = [search, `%${search}%`];
  let paymentIdx = 3;
  const paymentDate = buildDateClause({
    dateColumn: "ch.date_paid",
    params: paymentParams,
    index: paymentIdx,
  });
  paymentIdx = paymentDate.nextIdx;

  let paymentCustomerClause = "";
  if (customerName) {
    paymentCustomerClause = `AND c.name ILIKE $${paymentIdx++}`;
    paymentParams.push(`%${customerName}%`);
  }

  let paymentProductClause = "";
  if (productFilter) {
    paymentProductClause = `AND (p.brand ILIKE $${paymentIdx} OR CAST(p.weight_class AS text) ILIKE $${paymentIdx} OR p.status ILIKE $${paymentIdx})`;
    paymentParams.push(`%${productFilter}%`);
    paymentIdx += 1;
  }

  const paymentBaseWhere = `
     WHERE sr.status IN ${statusFilter}
       AND ($1 = '' OR c.name ILIKE $2 OR c.fb_name ILIKE $2 OR c.phone_number ILIKE $2
            OR p.brand ILIKE $2 OR CAST(p.weight_class AS text) ILIKE $2 OR p.status ILIKE $2
            OR ch.payment_option ILIKE $2 OR CAST(ch.balance_paid AS text) ILIKE $2)
       ${paymentDate.clause}
       ${paymentCustomerClause}
       ${paymentProductClause}`;

  const salesCountResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM sales_records sr
     JOIN customers c ON c.customer_id = sr.customer_id
     JOIN lpg_products p ON p.product_id = sr.product_id
     ${salesBaseWhere}`,
    salesParams,
  );

  const paymentCountResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM credit_history ch
    JOIN sales_records sr ON sr.sale_id = ch.sales_id
    JOIN customers c ON c.customer_id = sr.customer_id
    JOIN lpg_products p ON p.product_id = sr.product_id
    ${paymentBaseWhere}
    AND ch.payment_option = 'Credit'`,
    paymentParams,
  );

  const salesDataResult = await query(
  `SELECT
      sr.sale_id,
      sr.customer_id,
      sr.product_id,
      sr.status,
      sr.sale_quantity,
      sr.price_type,
      sr.unit_price,
      sr.total_amount,
      sr.lpg_tank_variant,
      sr.date_created,
      sr.date_updated,
      c.name AS customer_name,
      c.fb_name,
      c.phone_number,
      p.brand,
      p.weight_class,
      p.status AS product_status,
      ch.payment_option,
      sr.date_created AS log_date,
      'sale' AS entry_type
   FROM sales_records sr
   JOIN customers c ON c.customer_id = sr.customer_id
   JOIN lpg_products p ON p.product_id = sr.product_id
   LEFT JOIN (
    SELECT
        sales_id,
        CASE
            WHEN MAX(CASE WHEN payment_option = 'Credit' THEN 1 ELSE 0 END) = 1
                THEN 'Credit'
            ELSE 'Fully Paid'
        END AS payment_option
    FROM credit_history
    GROUP BY sales_id
) ch ON ch.sales_id = sr.sale_id  
   ${salesBaseWhere}
   ORDER BY sr.date_created DESC`,
  salesParams,
  );

  const paymentDataResult = await query(
    `SELECT
      ch.credit_id,
      ch.sales_id AS sale_id,
      ch.payment_option,
      ch.balance_paid,
      ch.date_paid,
      sr.customer_id,
      sr.product_id,
      sr.status,
      sr.sale_quantity,
      sr.price_type,
      sr.unit_price,
      sr.total_amount,
      sr.lpg_tank_variant,
      sr.date_created,
      sr.date_updated,
      c.name AS customer_name,
      c.fb_name,
      c.phone_number,
      p.brand,
      p.weight_class,
      p.status AS product_status,
      ch.date_paid AS log_date,
      'payment' AS entry_type
    FROM credit_history ch
    JOIN sales_records sr ON sr.sale_id = ch.sales_id
    JOIN customers c ON c.customer_id = sr.customer_id
    JOIN lpg_products p ON p.product_id = sr.product_id
    ${paymentBaseWhere}
    AND ch.payment_option = 'Credit'
    AND COALESCE(ch.balance_paid, 0) > 0
    ORDER BY ch.date_paid DESC`,
    paymentParams,
  );

  const paymentMap = new Map();

  paymentDataResult.rows.forEach((row) => {
    paymentMap.set(row.sale_id, row);
  });

  const combinedRows = [...salesDataResult.rows, ...paymentDataResult.rows]
  
    .map((row) => ({
      ...row,
      
      sale_quantity: row.sale_quantity ? Number(row.sale_quantity) : null,
      unit_price: Number(row.unit_price),
      total_amount: Number(row.total_amount),
      balance_paid: row.balance_paid ? Number(row.balance_paid) : null,
      weight_class: Number(row.weight_class),
      log_date: row.log_date || row.date_created || row.date_paid,
    }))
    .sort((left, right) => {
      const leftDate = new Date(left.log_date || 0).getTime();
      const rightDate = new Date(right.log_date || 0).getTime();
      if (rightDate !== leftDate) return rightDate - leftDate;
      return String(left.sale_id).localeCompare(String(right.sale_id));
    });
  const pagedRows = combinedRows.slice(offset, offset + limit);

  return {
    data: pagedRows,
    pagination: {
      page,
      limit,
      total: salesCountResult.rows[0].total + paymentCountResult.rows[0].total,
      totalPages: Math.ceil((salesCountResult.rows[0].total + paymentCountResult.rows[0].total) / limit) || 1,
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
  console.log("6. Done");
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
       COALESCE(SUM(sr.sale_quantity), 0)::int AS total_items_sold,
       COALESCE(SUM(pay.total_paid), 0)::numeric AS total_revenue
     FROM sales_records sr
     LEFT JOIN (
       SELECT sales_id, SUM(balance_paid)::numeric AS total_paid
       FROM credit_history
       GROUP BY sales_id
     ) pay ON pay.sales_id = sr.sale_id
     WHERE sr.status IN ('Active', 'Finished')`,
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
  const saleFilter = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "sr.date_created",
  );
  const paymentFilter = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "ch.date_paid",
  );

  const saleWhere = saleFilter.where;
  const saleParams = saleFilter.params;
  const paymentWhere = paymentFilter.where;
  const paymentParams = paymentFilter.params;

  const saleBaseFrom = `
    FROM sales_records sr
    JOIN lpg_products p ON p.product_id = sr.product_id
    LEFT JOIN (
      SELECT sales_id
      FROM credit_history
      WHERE payment_option = 'Credit'
      GROUP BY sales_id
    ) credit_sales ON credit_sales.sales_id = sr.sale_id
    WHERE sr.status IN ('Active', 'Finished')
    ${saleWhere}`;

  const paymentBaseFrom = `
    FROM credit_history ch
    JOIN sales_records sr ON sr.sale_id = ch.sales_id
    JOIN lpg_products p ON p.product_id = sr.product_id
    WHERE sr.status IN ('Active', 'Finished')
    ${paymentWhere}`;

  const summaryResult = await query(
    `SELECT
       COALESCE(SUM(sr.total_amount), 0)::numeric AS total_gross_revenue,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS total_cogs,
       COALESCE(SUM(CASE WHEN credit_sales.sales_id IS NULL THEN p.initial_price * sr.sale_quantity ELSE 0 END), 0)::numeric AS total_fully_paid_cogs,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS total_volume_kg,
       COUNT(*)::int AS total_orders
     ${saleBaseFrom}`,
    saleParams,
  );

  const paymentSummaryResult = await query(
    `SELECT
       COALESCE(SUM(ch.balance_paid), 0)::numeric AS total_gross_revenue
     ${paymentBaseFrom}`,
    paymentParams,
  );

  const summary = summaryResult.rows[0];
  const totalRevenue = Number(paymentSummaryResult.rows[0].total_gross_revenue);
  const costOfGoodsSold = Number(summary.total_cogs);
  const totalFullyPaidCostOfGoodsSold = Number(summary.total_fully_paid_cogs);
  const totalOrders = summary.total_orders || 0;
  const totalExpenses = await expenseService.getTotalExpenses({
    quickFilter,
    startDate,
    endDate,
  });

  const fullyPaidSalesResult = await query(
    `SELECT
       COALESCE(SUM(sr.total_amount), 0)::numeric AS total_fully_paid_sales
     FROM sales_records sr
     LEFT JOIN (
       SELECT sales_id
       FROM credit_history
       WHERE payment_option = 'Credit'
       GROUP BY sales_id
     ) credit_sales ON credit_sales.sales_id = sr.sale_id
     WHERE sr.status IN ('Active', 'Finished')
       ${saleWhere}
       AND credit_sales.sales_id IS NULL`,
    saleParams,
  );

  const creditBalanceResult = await query(
    `SELECT
       COALESCE(SUM(GREATEST(sr.total_amount - COALESCE(pay.total_paid, 0), 0)), 0)::numeric AS total_credit_balance
     FROM sales_records sr
     LEFT JOIN (
       SELECT sales_id, SUM(balance_paid)::numeric AS total_paid
       FROM credit_history
       GROUP BY sales_id
     ) pay ON pay.sales_id = sr.sale_id
     WHERE sr.status IN ('Active', 'Finished')
       ${saleWhere}
       AND EXISTS (
         SELECT 1
         FROM credit_history ch
         WHERE ch.sales_id = sr.sale_id
           AND ch.payment_option = 'Credit'
       )
       AND GREATEST(sr.total_amount - COALESCE(pay.total_paid, 0), 0) > 0`,
    saleParams,
  );

  const totalFullyPaidSales = Number(
    fullyPaidSalesResult.rows[0].total_fully_paid_sales || 0,
  );
  const totalCreditBalance = Number(
    creditBalanceResult.rows[0].total_credit_balance || 0,
  );
  const grossIncome = totalRevenue;
  const netIncome = Number(
    (grossIncome - costOfGoodsSold - totalExpenses).toFixed(2),
  );
  const reportSummary = buildSalesReportSummary({
    totalRevenue: grossIncome,
    costOfGoodsSold,
    totalExpenses,
    totalOrders,
    totalVolumeKg: Number(summary.total_volume_kg),
    totalFullyPaidSales,
    totalFullyPaidCostOfGoodsSold,
    totalCreditBalance,
  });

  const weightMixResult = await query(
    `SELECT
       p.weight_class,
       COALESCE(SUM(sr.sale_quantity), 0)::int AS units_sold,
       COALESCE(SUM(ch.balance_paid), 0)::numeric AS revenue
     ${paymentBaseFrom}
     GROUP BY p.weight_class
     ORDER BY p.weight_class ASC`,
    paymentParams,
  );

  const totalUnits =
    weightMixResult.rows.reduce((s, r) => s + r.units_sold, 0) || 1;

  const revenueBreakdownResult = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN p.status = 'Filled Tank' THEN ch.balance_paid ELSE 0 END), 0)::numeric AS gas_refill_revenue,
       COALESCE(SUM(CASE WHEN p.status = 'Empty Cylinder' THEN ch.balance_paid ELSE 0 END), 0)::numeric AS new_cylinder_revenue
     ${paymentBaseFrom}`,
    paymentParams,
  );

  const customerTypeResult = await query(
    `SELECT
       sr.price_type,
       COUNT(DISTINCT sr.sale_id)::int AS order_count,
       COALESCE(SUM(ch.balance_paid), 0)::numeric AS revenue
     ${paymentBaseFrom}
     GROUP BY sr.price_type`,
    paymentParams,
  );

  const paymentResult = await query(
    `SELECT
       CASE
         WHEN ch.payment_option = 'Credit' THEN 'Invoice / Credit'
         ELSE 'Cash'
       END AS payment_method,
       COUNT(*)::int AS transaction_count,
       COALESCE(SUM(ch.balance_paid), 0)::numeric AS revenue
     ${paymentBaseFrom}
     GROUP BY 1`,
    paymentParams,
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
        r.price_type === "Wholesale" ? "Retail Price" : "Consumer Price",
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
      ...reportSummary,
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
  const saleFilter = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "sr.date_created",
  );
  const paymentFilter = buildReportDateFilter(
    quickFilter,
    startDate,
    endDate,
    "ch.date_paid",
  );

  const paymentWhere = paymentFilter.where;
  const paymentParams = paymentFilter.params;
  const saleWhere = saleFilter.where;
  const saleParams = saleFilter.params;

  const dailyPayments = await query(
    `SELECT
       ${sqlManilaDate("ch.date_paid")} AS date,
       COUNT(*)::int AS orders,
       COALESCE(SUM(ch.balance_paid), 0)::numeric AS gross_income
     FROM credit_history ch
     JOIN sales_records sr ON sr.sale_id = ch.sales_id
     WHERE sr.status IN ('Active', 'Finished')
       ${paymentWhere}
     GROUP BY ${sqlManilaDate("ch.date_paid")}
     ORDER BY ${sqlManilaDate("ch.date_paid")} ASC`,
    paymentParams,
  );

  const dailyOrders = await query(
    `SELECT
       ${sqlManilaDate("sr.date_created")} AS date,
       COUNT(*)::int AS orders,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS volume_kg
     FROM sales_records sr
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.status IN ('Active', 'Finished')
       ${saleWhere}
     GROUP BY ${sqlManilaDate("sr.date_created")}
     ORDER BY ${sqlManilaDate("sr.date_created")} ASC`,
    saleParams,
  );

  const cogsByDate = await query(
    `SELECT
       ${sqlManilaDate("sr.date_created")} AS date,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS cogs,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS volume_kg
     FROM sales_records sr
     JOIN lpg_products p ON p.product_id = sr.product_id
     WHERE sr.status IN ('Active', 'Finished')
       ${saleWhere}
     GROUP BY ${sqlManilaDate("sr.date_created")}
     ORDER BY ${sqlManilaDate("sr.date_created")} ASC`,
    saleParams,
  );

  const fullyPaidByDate = await query(
    `SELECT
       ${sqlManilaDate("sr.date_created")} AS date,
       COALESCE(SUM(sr.total_amount), 0)::numeric AS fully_paid_gross_income,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS fully_paid_cogs
     FROM sales_records sr
     JOIN lpg_products p ON p.product_id = sr.product_id
     LEFT JOIN (
       SELECT sales_id
       FROM credit_history
       WHERE payment_option = 'Credit'
       GROUP BY sales_id
     ) credit_sales ON credit_sales.sales_id = sr.sale_id
     WHERE sr.status IN ('Active', 'Finished')
       ${saleWhere}
       AND credit_sales.sales_id IS NULL
     GROUP BY ${sqlManilaDate("sr.date_created")}
     ORDER BY ${sqlManilaDate("sr.date_created")} ASC`,
    saleParams,
  );

  const expenseByDate = await expenseService.getDailyExpenseTotals({
    quickFilter,
    startDate,
    endDate,
  });
  const expenseMap = new Map(
    expenseByDate.map((row) => [String(row.date), row.totalExpenses]),
  );

  const paymentMap = new Map(
    dailyPayments.rows.map((row) => [String(row.date), row]),
  );
  const orderMap = new Map(
    dailyOrders.rows.map((row) => [String(row.date), row]),
  );
  const cogsMap = new Map(
    cogsByDate.rows.map((row) => [String(row.date), row]),
  );
  const fullyPaidMap = new Map(
    fullyPaidByDate.rows.map((row) => [String(row.date), row]),
  );

  const allDates = new Set([
    ...dailyPayments.rows.map((row) => String(row.date)),
    ...dailyOrders.rows.map((row) => String(row.date)),
    ...cogsByDate.rows.map((row) => String(row.date)),
    ...fullyPaidByDate.rows.map((row) => String(row.date)),
    ...expenseByDate.map((row) => String(row.date)),
  ]);

  return Array.from(allDates)
    .sort((a, b) => new Date(a) - new Date(b))
    .map((date) => {
      const payment = paymentMap.get(date) || { orders: 0, gross_income: 0 };
      const orderRow = orderMap.get(date) || { orders: 0, volume_kg: 0 };
      const cogs = cogsMap.get(date) || { cogs: 0, volume_kg: 0 };
      const fullyPaid = fullyPaidMap.get(date) || {
        fully_paid_gross_income: 0,
        fully_paid_cogs: 0,
      };
      const dailyExpenses = expenseMap.get(date) || 0;
      const grossIncome = Number(payment.gross_income);
      const costOfGoodsSold = Number(cogs.cogs);
      const fullyPaidGrossIncome = Number(fullyPaid.fully_paid_gross_income);
      const fullyPaidCogs = Number(fullyPaid.fully_paid_cogs);
      return {
        date,
        orders: orderRow.orders,
        grossIncome,
        costOfGoodsSold,
        volumeKg: Number(orderRow.volume_kg),
        totalExpenses: dailyExpenses,
        netIncome: Number((grossIncome - costOfGoodsSold - dailyExpenses).toFixed(2)),
        netIncomeFullyPaid: Number(
          (fullyPaidGrossIncome - fullyPaidCogs - dailyExpenses).toFixed(2),
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

export async function getSalesLogPdfRows(period, startDate, endDate) {
  const saleFilter = buildExportDateFilter(period, startDate, endDate, 'sr.date_created');
  const paymentFilter = buildExportDateFilter(period, startDate, endDate, 'ch.date_paid');

  const saleSql = `
    SELECT
      sr.sale_id,
      sr.date_created,
      NULL::timestamp AS date_paid,
      sr.status,
      sr.sale_quantity,
      sr.price_type,
      sr.unit_price,
      sr.total_amount,
      sr.lpg_tank_variant,
      c.name AS customer_name,
      c.fb_name,
      c.phone_number,
      p.brand,
      p.weight_class,
      p.status AS product_status,
      COALESCE(sale_payment.payment_option, 'Fully Paid') AS payment_option,
      NULL::numeric AS balance_paid,
      'sale' AS entry_type,
      ${sqlManilaDate('sr.date_created')} AS log_date
    FROM sales_records sr
    JOIN customers c ON c.customer_id = sr.customer_id
    JOIN lpg_products p ON p.product_id = sr.product_id
    LEFT JOIN (
      SELECT sales_id,
        CASE
          WHEN MAX(CASE WHEN payment_option = 'Credit' THEN 1 ELSE 0 END) = 1 THEN 'Credit'
          ELSE 'Fully Paid'
        END AS payment_option
      FROM credit_history
      GROUP BY sales_id
    ) sale_payment ON sale_payment.sales_id = sr.sale_id
    WHERE sr.status IN ('Active', 'Finished', 'Dropped', 'Archived')
      ${saleFilter.where}
  `;

  const paymentSql = `
    SELECT
      sr.sale_id,
      sr.date_created,
      ch.date_paid,
      sr.status,
      sr.sale_quantity,
      sr.price_type,
      sr.unit_price,
      sr.total_amount,
      sr.lpg_tank_variant,
      c.name AS customer_name,
      c.fb_name,
      c.phone_number,
      p.brand,
      p.weight_class,
      p.status AS product_status,
      'Credit Payment' AS payment_option,
      ch.balance_paid,
      'payment' AS entry_type,
      ${sqlManilaDate('ch.date_paid')} AS log_date
    FROM credit_history ch
    JOIN sales_records sr ON sr.sale_id = ch.sales_id
    JOIN customers c ON c.customer_id = sr.customer_id
    JOIN lpg_products p ON p.product_id = sr.product_id
    WHERE sr.status IN ('Active', 'Finished', 'Dropped', 'Archived')
      ${paymentFilter.where}
      AND ch.payment_option = 'Credit'
      AND COALESCE(ch.balance_paid, 0) > 0
  `;

  const result = await query(
    `${saleSql}
     UNION ALL
     ${paymentSql}
     ORDER BY log_date DESC`,
    [...saleFilter.params, ...paymentFilter.params],
  );

  return result.rows;
}

function normalizeExportPeriod(period) {
  if (period === "today") return "current_day";
  return period;
}

export async function getSalesReportAnalytics(period, startDate, endDate) {
  const exportPeriod = normalizeExportPeriod(period);
  const saleFilter = buildDateFilter(exportPeriod, startDate, endDate, "sr.date_created");
  const paymentFilter = buildDateFilter(exportPeriod, startDate, endDate, "ch.date_paid");
  const saleWhere = saleFilter.where;
  const saleParams = saleFilter.params;
  const paymentWhere = paymentFilter.where;
  const paymentParams = paymentFilter.params;

  const saleBaseFrom = `
    FROM sales_records sr
    JOIN lpg_products p ON p.product_id = sr.product_id
    LEFT JOIN (
      SELECT sales_id
      FROM credit_history
      WHERE payment_option = 'Credit'
      GROUP BY sales_id
    ) credit_sales ON credit_sales.sales_id = sr.sale_id
    WHERE sr.status IN ('Active', 'Finished')
    ${saleWhere}`;

  const paymentBaseFrom = `
    FROM credit_history ch
    JOIN sales_records sr ON sr.sale_id = ch.sales_id
    JOIN lpg_products p ON p.product_id = sr.product_id
    WHERE sr.status IN ('Active', 'Finished')
    ${paymentWhere}`;

  const summaryResult = await query(
    `SELECT
       COALESCE(SUM(sr.total_amount), 0)::numeric AS total_gross_revenue,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS total_cogs,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS total_volume_kg,
       COUNT(*)::int AS total_orders
     ${saleBaseFrom}`,
    saleParams,
  );

  const paymentSummaryResult = await query(
    `SELECT
       COALESCE(SUM(ch.balance_paid), 0)::numeric AS total_gross_revenue
     ${paymentBaseFrom}`,
    paymentParams,
  );

  const summary = summaryResult.rows[0];
  const grossIncome = Number(paymentSummaryResult.rows[0].total_gross_revenue);
  const costOfGoodsSold = Number(summary.total_cogs);
  const totalOrders = summary.total_orders || 0;
  const totalVolumeKg = Number(summary.total_volume_kg);
  const totalExpenses = await expenseService.getTotalExpensesForExport(
    exportPeriod,
    startDate,
    endDate,
  );
  const netIncome = Number(
    (grossIncome - costOfGoodsSold - totalExpenses).toFixed(2),
  );

  const dailyPaymentsResult = await query(
    `SELECT
       ${sqlManilaDate("ch.date_paid")} AS date,
       COUNT(*)::int AS orders,
       COALESCE(SUM(ch.balance_paid), 0)::numeric AS gross_income
     ${paymentBaseFrom}
     GROUP BY ${sqlManilaDate("ch.date_paid")}
     ORDER BY ${sqlManilaDate("ch.date_paid")} ASC`,
    paymentParams,
  );

  const cogsByDate = await query(
    `SELECT
       ${sqlManilaDate("sr.date_created")} AS date,
       COALESCE(SUM(p.initial_price * sr.sale_quantity), 0)::numeric AS cogs,
       COALESCE(SUM(p.weight_class * sr.sale_quantity), 0)::numeric AS volume_kg
     ${saleBaseFrom}
     GROUP BY ${sqlManilaDate("sr.date_created")}
     ORDER BY ${sqlManilaDate("sr.date_created")} ASC`,
    saleParams,
  );

  const expenseByDate = await expenseService.getDailyExpenseTotalsForExport(
    exportPeriod,
    startDate,
    endDate,
  );
  const expenseMap = new Map(
    expenseByDate.map((row) => [String(row.date), row.totalExpenses]),
  );

  const paymentMap = new Map(
    dailyPaymentsResult.rows.map((row) => [String(row.date), row]),
  );
  const cogsMap = new Map(
    cogsByDate.rows.map((row) => [String(row.date), row]),
  );

  const allDates = new Set([
    ...dailyPaymentsResult.rows.map((row) => String(row.date)),
    ...cogsByDate.rows.map((row) => String(row.date)),
    ...expenseByDate.map((row) => String(row.date)),
  ]);

  const dailyMetrics = Array.from(allDates)
    .sort((a, b) => new Date(a) - new Date(b))
    .map((date) => {
      const payment = paymentMap.get(date) || { orders: 0, gross_income: 0 };
      const cogs = cogsMap.get(date) || { cogs: 0, volume_kg: 0 };
      const dayExpenses = expenseMap.get(date) || 0;
      const dayGross = Number(payment.gross_income);
      const dayCogs = Number(cogs.cogs);
      return {
        date,
        orders: payment.orders,
        grossIncome: dayGross,
        volumeKg: Number(cogs.volume_kg),
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
     ${saleBaseFrom}
     GROUP BY p.brand
     ORDER BY units_sold DESC`,
    saleParams,
  );

  const customerTypeResult = await query(
    `SELECT
       CASE WHEN sr.price_type = 'Wholesale' THEN 'Retail Price' ELSE 'Consumer Price' END AS customer_type,
       COUNT(*)::int AS order_count
     ${saleBaseFrom}
     GROUP BY 1`,
    saleParams,
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
