import { body, param, query as q } from 'express-validator';
import * as salesService from '../services/salesService.js';
import { PRICE_TYPES } from '../utils/constants.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const listSales = [
  q('search').optional().isString(),
  q('archived').optional().isIn(['true', 'false']),
  q('page').optional().isInt({ min: 1 }),
  q('limit').optional().isInt({ min: 1, max: 100 }),
  q('todayOnly').optional().isIn(['true', 'false']),
  asyncHandler(async (req, res) => {
    const result = await salesService.listSales({
      search: req.query.search || '',
      archived: req.query.archived === 'true',
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      todayOnly: req.query.todayOnly === 'true',
    });
    res.json({ success: true, ...result });
  }),
];

export const createSale = [
  body('productId').notEmpty().withMessage('Product is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be positive'),
  body('priceType').isIn(PRICE_TYPES).withMessage('Invalid price type'),
  body('customerId').optional().isUUID(),
  body('customerName').if(body('customerId').not().exists()).notEmpty().withMessage('Customer name is required'),
  asyncHandler(async (req, res) => {
    const sale = await salesService.createSale({
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      fbName: req.body.fbName,
      phoneNumber: req.body.phoneNumber,
      productId: req.body.productId,
      quantity: req.body.quantity,
      unitPrice: req.body.unitPrice,
      priceType: req.body.priceType,
    });
    res.status(201).json({ success: true, data: sale });
  }),
];

export const updateSale = [
  param('saleId').isUUID(),
  body('customerName').notEmpty(),
  body('productId').notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('unitPrice').isFloat({ min: 0 }),
  body('priceType').isIn(PRICE_TYPES),
  asyncHandler(async (req, res) => {
    const sale = await salesService.updateSale(req.params.saleId, {
      customerName: req.body.customerName,
      fbName: req.body.fbName,
      phoneNumber: req.body.phoneNumber,
      productId: req.body.productId,
      quantity: req.body.quantity,
      unitPrice: req.body.unitPrice,
      priceType: req.body.priceType,
    });
    res.json({ success: true, data: sale });
  }),
];

export const dropSale = [
  param('saleId').isUUID(),
  asyncHandler(async (req, res) => {
    const sale = await salesService.dropSale(req.params.saleId);
    res.json({ success: true, data: sale });
  }),
];
