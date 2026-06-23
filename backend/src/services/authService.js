import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { createResetToken, hashToken } from '../utils/tokens.js';
import { normalizeUsername } from '../utils/username.js';
import { env } from '../config/env.js';

const ADMIN_AUTH_SELECT = `
  admin_id, name, role, status, username, password_hash, email, phone_number
`;

export async function findAdminByUsername(username) {
  const normalized = normalizeUsername(username);
  const result = await query(
    `SELECT ${ADMIN_AUTH_SELECT}
     FROM admins WHERE LOWER(username) = $1 LIMIT 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

export async function registerAdmin({ name, username, password, email, phoneNumber }) {
  const normalized = normalizeUsername(username);
  const existing = await findAdminByUsername(normalized);
  if (existing) {
    throw new AppError('This username is already taken', 409);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailCheck = await query(
    `SELECT admin_id FROM admins WHERE LOWER(email) = $1 LIMIT 1`,
    [normalizedEmail]
  );
  if (emailCheck.rows[0]) {
    throw new AppError('This email is already in use', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO admins (name, role, status, username, password_hash, email, phone_number)
     VALUES ($1, 'Staff', 'Active', $2, $3, $4, $5)
     RETURNING admin_id, name, role, status, username, email, phone_number`,
    [name.trim(), normalized, passwordHash, normalizedEmail, phoneNumber?.trim() || null]
  );

  return result.rows[0];
}

export async function loginAdmin(username, password) {
  const admin = await findAdminByUsername(username);
  if (!admin || admin.status !== 'Active') {
    throw new AppError('Invalid username or password', 401);
  }

  const valid = await bcrypt.compare(password, admin.password_hash || '');
  if (!valid) {
    throw new AppError('Invalid username or password', 401);
  }

  return admin;
}

export async function seedDefaultAdmin() {
  const existing = await findAdminByUsername(env.seedAdminUsername);
  if (existing?.password_hash) {
    return { message: 'Admin already seeded', username: env.seedAdminUsername };
  }

  const passwordHash = await bcrypt.hash(env.seedAdminPassword, 12);
  const normalized = normalizeUsername(env.seedAdminUsername);

  if (existing) {
    await query('UPDATE admins SET password_hash = $1, username = $2 WHERE admin_id = $3', [
      passwordHash,
      normalized,
      existing.admin_id,
    ]);
  } else {
    const seedEmail = `${normalized}@admin.rclpg.local`;
    await query(
      `INSERT INTO admins (name, role, status, username, password_hash, email)
       VALUES ($1, 'Administrator', 'Active', $2, $3, $4)`,
      [env.seedAdminName, normalized, passwordHash, seedEmail]
    );
  }

  return { message: 'Default admin seeded', username: env.seedAdminUsername };
}
