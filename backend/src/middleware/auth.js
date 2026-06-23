import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { isAdministratorRole } from '../utils/roles.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.admin = payload;
    next();
  } catch {
    next(new AppError('Invalid or expired session. Please log in again.', 401));
  }
}

export function requireAdministrator(req, _res, next) {
  if (!isAdministratorRole(req.admin?.role)) {
    return next(new AppError('Administrator access required', 403));
  }
  next();
}

export function signToken(admin) {
  const expiresAt = getMidnightExpirySeconds();
  return jwt.sign(
    {
      adminId: admin.admin_id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
      exp: expiresAt,
    },
    env.jwtSecret
  );
}

function getMidnightExpirySeconds() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor(midnight.getTime() / 1000);
}

export function getSessionExpiryIso() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.toISOString();
}
