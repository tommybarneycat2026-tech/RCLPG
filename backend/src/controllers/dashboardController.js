import { query as q } from "express-validator";
import * as salesService from "../services/salesService.js";
import * as productService from "../services/productService.js";
import * as reportService from "../services/reportService.js";
import * as creditService from "../services/creditService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { toManilaDateISO } from "../utils/timezone.js";

export const getMetrics = asyncHandler(async (_req, res) => {
  // Brand-level sales distribution now lives inside the Sales Report
  // section (admin-only, filter-aware) instead of the general dashboard
  // metrics payload that every authenticated user (including staff) reads.
  const [salesMetrics, inventoryMetrics, lowStock] = await Promise.all([
    salesService.getDashboardSalesMetrics(),
    productService.getInventoryMetrics(),
    productService.getLowStockProducts(),
  ]);

  res.json({
    success: true,
    data: {
      totalItemsSold: salesMetrics.total_items_sold,
      totalRevenue: Number(salesMetrics.total_revenue),
      totalFilledStock: inventoryMetrics.total_filled,
      totalEmptyStock: inventoryMetrics.total_empty,
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock,
    },
  });
});

export const exportReport = [
  q("format").isIn(["excel", "pdf"]).withMessage("Format must be excel or pdf"),
  q("period")
    .isIn(["current_day", "daily", "monthly", "yearly", "custom"])
    .withMessage("Invalid period"),
  q("startDate").optional().isISO8601(),
  q("endDate").optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const { format, period, startDate, endDate } = req.query;
    const rows = await salesService.getReportRows(period, startDate, endDate);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No sales data for selected period" });
    }

    const title = `RCLPG Sales Report - ${period}`;
    const filenameBase = `RCLPG_Sales_${period}_${Date.now()}`;

    if (format === "excel") {
      const buffer = await reportService.buildExcelBuffer(rows, title);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenameBase}.xlsx"`,
      );
      return res.send(Buffer.from(buffer));
    }

    const buffer = await reportService.buildPdfBuffer(rows, title);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filenameBase}.pdf"`,
    );
    return res.send(buffer);
  }),
];

export const getSalesReport = [
  q("quickFilter")
    .optional()
    .isIn(["today", "week", "month", "year", "first_half", "second_half", "custom"]),
  q("startDate").optional().isISO8601(),
  q("endDate").optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const data = await salesService.getSalesReport({
      quickFilter: req.query.quickFilter || "month",
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.json({ success: true, data });
  }),
];

export const getDailyMetrics = [
  q("quickFilter")
    .optional()
    .isIn(["today", "week", "month", "year", "first_half", "second_half", "custom"]),
  q("startDate").optional().isISO8601(),
  q("endDate").optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const data = await salesService.getDailyMetrics({
      quickFilter: req.query.quickFilter || "month",
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.json({ success: true, data });
  }),
];

export const downloadSalesLog = [
  q("period")
    .isIn(["today", "daily", "weekly", "monthly", "first_half", "second_half", "yearly", "custom"]).withMessage("Invalid period"),
  q("startDate").optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const { period, startDate, endDate, format } = req.query;

    const exportPeriod = period === 'today' ? 'current_day' : period;
    const rows =
      format === 'pdf' || !format
        ? await salesService.getSalesLogPdfRows(exportPeriod, startDate, endDate)
        : await salesService.getReportRows(exportPeriod, startDate, endDate);

    const title = 'RCLPG Customer & Sales Log';
    if (format === 'pdf' || !format) {
      const buffer = await reportService.buildSalesLogPdfBuffer(rows, title, req.user?.name);
      const filenameBase = `RCLPG_Sales_Log_${period}_${Date.now()}`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
      return res.send(buffer);
    }

    const buffer = await reportService.buildSalesLogExcelBuffer(rows, title);
    const filenameBase = `RCLPG_Sales_Log_${period}_${Date.now()}`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    return res.send(Buffer.from(buffer));
  }),
];

export const downloadSalesReport = [
  q('period')
    .isIn(['today', 'daily', 'weekly', 'monthly', 'first_half', 'second_half', 'yearly', 'custom'])
    .withMessage('Invalid period'),
  q('startDate').optional().isISO8601(),
  q('endDate').optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const { period, startDate, endDate, format } = req.query;

    if ((period === 'monthly' || period === 'yearly') && !startDate) {
      return res.status(400).json({ success: false, message: 'Reference date is required for this period' });
    }
    if (period === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({ success: false, message: 'Start and end dates are required for custom range' });
    }

    const analytics = await salesService.getSalesReportAnalytics(period, startDate, endDate);

    const periodLabels = {
      today: 'Today',
      monthly: startDate
        ? new Date(startDate).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
        : 'Monthly',
      yearly: startDate ? new Date(startDate).getFullYear() : 'Yearly',
      custom: `${startDate} to ${endDate}`,
      first_half: 'First Half',
      second_half: 'Second Half',
      weekly: 'Weekly',
      daily: startDate || 'Daily',
    };

    const title = 'RCLPG Sales Report';
    if (format === 'pdf' || !format) {
      const buffer = await reportService.buildSalesReportPdfBuffer(
        analytics,
        title,
        periodLabels[period] || period,
        req.user?.name,
      );
      const filenameBase = `RCLPG_Sales_Report_${period}_${Date.now()}`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
      return res.send(buffer);
    }

    const buffer = await reportService.buildSalesReportExcelBuffer(analytics, title, periodLabels[period] || period);
    const filenameBase = `RCLPG_Sales_Report_${period}_${Date.now()}`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    return res.send(Buffer.from(buffer));
  }),
];

export const downloadCreditLog = [
  q('period')
    .isIn(['daily', 'weekly', 'monthly', 'first_half', 'second_half', 'yearly', 'custom'])
    .withMessage('Invalid period'),
  q('startDate').optional().isISO8601(),
  q('endDate').optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const { period, startDate, endDate } = req.query;
    // For credit logs we reuse the credit register and filter on date if provided
    const rows = await creditService.getCreditRegister();
    // Optionally filter rows by date range if provided
    let filtered = rows;
    if (period === 'daily' && startDate) {
      filtered = rows.filter((r) => toManilaDateISO(r.date_created) === startDate);
    } else if (period === 'monthly' && startDate) {
      const targetMonth = toManilaDateISO(startDate).slice(0, 7);
      filtered = rows.filter((r) => toManilaDateISO(r.date_created).slice(0, 7) === targetMonth);
    }

    const summary = {
      totalOutstanding: filtered.reduce((s, r) => s + (r.remaining_credit || 0), 0),
      totalPaid: filtered.reduce((s, r) => s + (r.total_paid || 0), 0),
      totalRemaining: filtered.reduce((s, r) => s + (r.remaining_credit || 0), 0),
      paidAccounts: filtered.filter((r) => r.remaining_credit <= 0).length,
      unpaidAccounts: filtered.filter((r) => r.remaining_credit > 0).length,
    };

    const buffer = await reportService.buildCreditLogPdfBuffer(filtered, 'RCLPG Credit Log Report', summary, req.user?.name);
    const filenameBase = `RCLPG_Credit_Log_${Date.now()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
    return res.send(buffer);
  }),
];
