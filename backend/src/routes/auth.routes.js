import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';

const router = Router();

// Use the spread operator (...) to cleanly inject the controller arrays
router.post('/register', ...authController.register, validate);
router.post('/login', ...authController.login, validate);

router.get('/me', authenticate, authController.me);

export default router;
