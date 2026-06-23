import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as customerController from '../controllers/customerController.js';

const router = Router();

router.use(authenticate);
router.get('/', ...customerController.listCustomers, validate);

export default router;
