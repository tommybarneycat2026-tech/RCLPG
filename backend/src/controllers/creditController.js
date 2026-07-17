import { body, param } from 'express-validator';
import * as creditService from '../services/creditService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { broadcastRealtime } from '../utils/realtime.js';

export const listCreditRegister = asyncHandler(async (_req, res) => {
  const data = await creditService.getCreditRegister();
  res.json({ success: true, data });
});

export const getCreditSummary = [
  param('saleId').isUUID(),
  asyncHandler(async (req, res) => {
    const data = await creditService.getCreditSummary(req.params.saleId);
    res.json({ success: true, data });
  }),
];

export const getPaymentHistory = [
  param('saleId').isUUID(),
  asyncHandler(async (req, res) => {
    const saleId = req.params.saleId;
    const [history, summary] = await Promise.all([
      creditService.getPaymentHistory(saleId),
      creditService.getCreditSummary(saleId),
    ]);
    res.json({
      success: true,
      data: {
        history: history.map((h) => ({ ...h, balance_paid: Number(h.balance_paid) })),
        totalPaid: summary.total_paid,
        remainingCredit: summary.remaining_credit,
      },
    });
  }),
];

export const createPayment = [
  param('saleId').isUUID(),
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than zero'),
  asyncHandler(async (req, res) => {
    const result = await creditService.createInstallmentPayment(
      req.params.saleId,
      req.body.amount
    );
    broadcastRealtime('credits:changed', { action: 'payment-recorded', saleId: req.params.saleId, result });
    res.status(201).json({ success: true, data: result });
  }),
];
