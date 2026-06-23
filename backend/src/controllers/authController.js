import { body } from 'express-validator';
import * as authService from '../services/authService.js';
import * as adminService from '../services/adminService.js';
import { signToken, getSessionExpiryIso } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isValidUsername } from '../utils/username.js';

function mapAuthAdmin(admin) {
  return {
    adminId: admin.admin_id,
    name: admin.name,
    username: admin.username,
    email: admin.email || '',
    phoneNumber: admin.phone_number || '',
    role: admin.role,
  };
}

const usernameValidation = body('username')
  .trim()
  .notEmpty()
  .withMessage('Username is required')
  .custom((value) => {
    if (!isValidUsername(value)) {
      throw new Error('Username must be 3-30 characters and use letters, numbers, or underscores only');
    }
    return true;
  });

export const login = [
  usernameValidation,
  body('password').notEmpty().withMessage('Password is required'),
  asyncHandler(async (req, res) => {
    const admin = await authService.loginAdmin(req.body.username, req.body.password);
    const token = signToken(admin);
    res.json({
      success: true,
      token,
      expiresAt: getSessionExpiryIso(),
      admin: mapAuthAdmin(admin),
    });
  }),
];

export const register = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  usernameValidation,
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phoneNumber').optional().isString(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  asyncHandler(async (req, res) => {
    const admin = await authService.registerAdmin({
      name: req.body.name,
      username: req.body.username,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      password: req.body.password,
    });
    res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      admin: mapAuthAdmin(admin),
    });
  }),
];

export const me = asyncHandler(async (req, res) => {
  const user = await adminService.findAdminById(req.admin.adminId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Profile not found' });
  }
  res.json({
    success: true,
    admin: mapAuthAdmin(user),
    expiresAt: getSessionExpiryIso(),
  });
});
