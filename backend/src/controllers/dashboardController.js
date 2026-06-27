import { query as q } from 'express-validator';
import * as salesService from '../services/salesService.js';
import * as productService from '../services/productService.js';
import * as reportService from '../services/reportService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getMetrics = asyncHandler(async (_req, res) => {
  const [salesMetrics, inventoryMetrics, lowStock, brandMetrics] = await Promise.all([
    salesService.getDashboardSalesMetrics(),
    productService.getInventoryMetrics(),
    productService.getLowStockProducts(),
    salesService.getBrandSalesMetrics(),
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
      brandSalesMetrics: brandMetrics,
    },
  });
});

export const exportReport = [
  q('format').isIn(['excel', 'pdf']).withMessage('Format must be excel or pdf'),
  q('period').isIn(['current_day', 'daily', 'monthly', 'yearly', 'custom']).withMessage('Invalid period'),
  q('startDate').optional().isISO8601(),
  q('endDate').optional().isISO8601(),
  asyncHandler(async (req, res) => {
    const { format, period, startDate, endDate } = req.query;
    const rows = await salesService.getReportRows(period, startDate, endDate);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No sales data for selected period' });
    }

    const title = `RCLPG Sales Report - ${period}`;
    const filenameBase = `RCLPG_Sales_${period}_${Date.now()}`;

    if (format === 'excel') {
      const buffer = await reportService.buildExcelBuffer(rows, title);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }

    const buffer = await reportService.buildPdfBuffer(rows, title);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
    return res.send(buffer);
  }),
];
