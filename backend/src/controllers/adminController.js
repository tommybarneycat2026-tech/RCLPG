import { body, param, query as q } from 'express-validator';
import * as adminService from '../services/adminService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isValidUsername } from '../utils/username.js';

const usernameValidation = body('username')
  .optional()
  .trim()
  .notEmpty()
  .withMessage('Username is required')
  .custom((value) => {
    if (!isValidUsername(value)) {
      throw new Error('Username must be 3-30 characters and use letters, numbers, or underscores only');
    }
    return true;
  });

const emailValidation = body('email')
  .optional()
  .trim()
  .isEmail()
  .withMessage('A valid email address is required')
  .normalizeEmail();

export const listUsers = [
  q('includeArchived').optional().isIn(['true', 'false']),
  asyncHandler(async (req, res) => {
    const users = await adminService.listAdmins({
      includeArchived: req.query.includeArchived === 'true',
    });
    res.json({ success: true, data: users });
  }),
];

export const getUser = [
  param('adminId').isUUID().withMessage('Invalid user ID'),
  asyncHandler(async (req, res) => {
    const user = await adminService.findAdminById(req.params.adminId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: adminService.mapAdmin(user) });
  }),
];

export const updateOwnProfile = [
  body('name').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
  usernameValidation,
  emailValidation,
  body('phoneNumber').optional().isString(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  asyncHandler(async (req, res) => {
    const updated = await adminService.updateOwnProfile(req.admin.adminId, req.admin.role, {
      name: req.body.name,
      username: req.body.username,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      password: req.body.password,
    });
    res.json({ success: true, data: updated });
  }),
];

export const updateUser = [
  param('adminId').isUUID().withMessage('Invalid user ID'),
  body('name').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
  usernameValidation,
  emailValidation,
  body('phoneNumber').optional().isString(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  asyncHandler(async (req, res) => {
    const updated = await adminService.updateAdminById(req.params.adminId, {
      name: req.body.name,
      username: req.body.username,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      password: req.body.password,
    });
    res.json({ success: true, data: updated });
  }),
];

export const archiveUser = [
  param('adminId').isUUID().withMessage('Invalid user ID'),
  asyncHandler(async (req, res) => {
    const updated = await adminService.archiveAdmin(req.params.adminId, req.admin.adminId);
    res.json({ success: true, data: updated, message: 'User archived successfully' });
  }),
];

export const createUser = [
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').trim().isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('role').trim().notEmpty().withMessage('Role is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  asyncHandler(async (req, res) => {
    const created = await adminService.createAdmin({
      name: req.body.name,
      username: req.body.username,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      role: req.body.role,
      password: req.body.password,
    });
    res.status(201).json({ success: true, data: created, message: 'User created' });
  }),
];

export const getOwnProfile = asyncHandler(async (req, res) => {
  const user = await adminService.findAdminById(req.admin.adminId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Profile not found' });
  }
  res.json({ success: true, data: adminService.mapAdmin(user) });
});
