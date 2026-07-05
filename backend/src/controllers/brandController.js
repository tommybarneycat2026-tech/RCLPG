import { body } from 'express-validator';
import * as brandService from '../services/brandService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const listBrands = asyncHandler(async (_req, res) => {
  const data = await brandService.listBrands();
  res.json({ success: true, data });
});

export const createBrand = [
  body('name').trim().notEmpty().withMessage('Brand name is required'),
  asyncHandler(async (req, res) => {
    const brand = await brandService.createBrand(req.body.name);
    res.status(201).json({ success: true, data: brand });
  }),
];
