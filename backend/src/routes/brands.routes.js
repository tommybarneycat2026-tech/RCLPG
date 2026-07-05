import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as brandController from '../controllers/brandController.js';

const router = Router();

router.use(authenticate);

router.get('/', brandController.listBrands);
router.post('/', ...brandController.createBrand, validate);

export default router;
