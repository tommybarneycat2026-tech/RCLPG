import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as productController from '../controllers/productController.js';

const router = Router();

router.use(authenticate);

// Clean, spread-based routing
router.get('/', ...productController.listProducts, validate);
router.post('/', ...productController.createProduct, validate);
router.put('/:productId', ...productController.updateProduct, validate);
router.patch('/:productId/archive', ...productController.archiveProduct, validate);

// Static endpoints
router.get('/summary/weekly', productController.weeklySummary);
router.get('/alerts/low-stock', productController.lowStock);

export default router;