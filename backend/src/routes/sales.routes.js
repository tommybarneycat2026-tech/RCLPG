import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as salesController from '../controllers/salesController.js';

const router = Router();

router.use(authenticate);

// Clean, spread-based routing
router.get('/', ...salesController.listSales, validate);
router.post('/', ...salesController.createSale, validate);
router.put('/:saleId', ...salesController.updateSale, validate);
router.patch('/:saleId/drop', ...salesController.dropSale, validate);

export default router;