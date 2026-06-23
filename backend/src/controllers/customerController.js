import { query as q } from 'express-validator';
import * as customerService from '../services/customerService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const listCustomers = [
  q('search').optional().isString(),
  asyncHandler(async (req, res) => {
    const customers = await customerService.listCustomers(req.query.search || '');
    res.json({ success: true, data: customers });
  }),
];
