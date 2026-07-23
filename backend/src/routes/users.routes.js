import { Router } from 'express';
import { authenticate, requireAdministrator } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

router.use(authenticate);
router.get('/me', adminController.getOwnProfile);
router.post('/', requireAdministrator, ...adminController.createUser, validate);
router.put('/me', ...adminController.updateOwnProfile, validate);

router.get('/', requireAdministrator, ...adminController.listUsers, validate);
router.get('/:adminId', requireAdministrator, ...adminController.getUser, validate);
router.put('/:adminId', requireAdministrator, ...adminController.updateUser, validate);
router.delete('/:adminId', requireAdministrator, ...adminController.deleteUser, validate);
router.patch('/:adminId/archive', requireAdministrator, ...adminController.archiveUser, validate);

export default router;
