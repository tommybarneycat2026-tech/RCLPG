import { query as q } from "express-validator";
import * as salesService from "../services/salesService.js";
import * as productService from "../services/productService.js";
import * as reportService from "../services/reportService.js";
import { asyncHandler } from "../middleware/errorHandler.js";

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
    .isIn(["today", "week", "month", "year", "custom"]),
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
    .isIn(["today", "week", "month", "year", "custom"]),
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
    .isIn(["today", "monthly", "yearly"])
    .withMessage("Invalid period"),
  q("startDate").optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const { period, startDate } = req.query;

    if ((period === "monthly" || period === "yearly") && !startDate) {
      return res.status(400).json({
        success: false,
        message: "Reference date is required for this period",
      });
    }

    const exportPeriod = period === "today" ? "current_day" : period;
    const rows = await salesService.getReportRows(
      exportPeriod,
      startDate,
      null,
    );

    const title = "RCLPG Customer & Sales Log";
    const buffer = await reportService.buildSalesLogExcelBuffer(rows, title);

    const filenameBase = `RCLPG_Sales_Log_${period}_${Date.now()}`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filenameBase}.xlsx"`,
    );
    return res.send(Buffer.from(buffer));
  }),
];

export const downloadSalesReport = [
  q("period")
    .isIn(["today", "monthly", "yearly", "custom"])
    .withMessage("Invalid period"),
  q("startDate").optional().isISO8601(),
  q("endDate").optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const { period, startDate, endDate } = req.query;

    if ((period === "monthly" || period === "yearly") && !startDate) {
      return res.status(400).json({
        success: false,
        message: "Reference date is required for this period",
      });
    }
    if (period === "custom" && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message: "Start and end dates are required for custom range",
      });
    }

    const analytics = await salesService.getSalesReportAnalytics(
      period,
      startDate,
      endDate,
    );

    const periodLabels = {
      today: "Today",
      monthly: startDate
        ? new Date(startDate).toLocaleDateString("en-PH", {
            month: "long",
            year: "numeric",
          })
        : "Monthly",
      yearly: startDate ? new Date(startDate).getFullYear() : "Yearly",
      custom: `${startDate} to ${endDate}`,
    };

    const title = "RCLPG Sales Report";
    const buffer = await reportService.buildSalesReportExcelBuffer(
      analytics,
      title,
      periodLabels[period] || period,
    );

    const filenameBase = `RCLPG_Sales_Report_${period}_${Date.now()}`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filenameBase}.xlsx"`,
    );
    return res.send(Buffer.from(buffer));
  }),
];
