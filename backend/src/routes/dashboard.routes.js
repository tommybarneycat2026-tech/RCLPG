import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as dashboardController from '../controllers/dashboardController.js';

const router = Router();

router.use(authenticate);

router.get('/metrics', dashboardController.getMetrics);
router.get('/sales-report', ...dashboardController.getSalesReport, validate);
router.get('/daily-metrics', ...dashboardController.getDailyMetrics, validate);
router.get('/export', ...dashboardController.exportReport, validate);

export default router;
