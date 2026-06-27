import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as creditController from '../controllers/creditController.js';

const router = Router();

router.use(authenticate);

router.get('/', creditController.listCreditRegister);
router.get('/:saleId/summary', ...creditController.getCreditSummary, validate);
router.get('/:saleId/history', ...creditController.getPaymentHistory, validate);
router.post('/:saleId/payments', ...creditController.createPayment, validate);

export default router;
