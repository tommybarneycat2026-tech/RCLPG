import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeUsername } from '../utils/username.js';
import { isAdministratorRole } from '../utils/roles.js';

const ADMIN_SELECT = `
  admin_id, name, username, email, phone_number, role, status, created_at
`;

export function mapAdmin(row) {
  if (!row) return null;
  return {
    adminId: row.admin_id,
    name: row.name,
    username: row.username,
    email: row.email || '',
    phoneNumber: row.phone_number || '',
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function findAdminById(adminId) {
  const result = await query(
    `SELECT ${ADMIN_SELECT} FROM admins WHERE admin_id = $1 LIMIT 1`,
    [adminId]
  );
  return result.rows[0] || null;
}

export async function findAdminByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const result = await query(
    `SELECT admin_id FROM admins WHERE LOWER(email) = $1 LIMIT 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

export async function listAdmins({ includeArchived = false } = {}) {
  const status = includeArchived ? 'Archived' : 'Active';
  const result = await query(
    `SELECT ${ADMIN_SELECT}
     FROM admins
     WHERE status = $1
     ORDER BY name ASC`,
    [status]
  );
  return result.rows.map(mapAdmin);
}

export async function updateOwnProfile(adminId, role, fields) {
  const current = await findAdminById(adminId);
  if (!current) {
    throw new AppError('Profile not found', 404);
  }

  const isAdministrator = isAdministratorRole(role);
  const updates = [];
  const values = [];
  let idx = 1;

  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (!name) throw new AppError('Full name is required', 400);
    updates.push(`name = $${idx++}`);
    values.push(name);
  }

  if (isAdministrator) {
    if (fields.username !== undefined) {
      const normalized = normalizeUsername(fields.username);
      const existing = await query(
        `SELECT admin_id FROM admins WHERE LOWER(username) = $1 AND admin_id <> $2 LIMIT 1`,
        [normalized, adminId]
      );
      if (existing.rows[0]) {
        throw new AppError('This username is already taken', 409);
      }
      updates.push(`username = $${idx++}`);
      values.push(normalized);
    }

    if (fields.email !== undefined) {
      const email = fields.email.trim().toLowerCase();
      if (!email) throw new AppError('Email is required', 400);
      const existing = await query(
        `SELECT admin_id FROM admins WHERE LOWER(email) = $1 AND admin_id <> $2 LIMIT 1`,
        [email, adminId]
      );
      if (existing.rows[0]) {
        throw new AppError('This email is already in use', 409);
      }
      updates.push(`email = $${idx++}`);
      values.push(email);
    }

    if (fields.phoneNumber !== undefined) {
      updates.push(`phone_number = $${idx++}`);
      values.push(fields.phoneNumber.trim() || null);
    }
  }

  if (fields.password) {
    if (fields.password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    const passwordHash = await bcrypt.hash(fields.password, 12);
    updates.push(`password_hash = $${idx++}`);
    values.push(passwordHash);
  }

  if (updates.length === 0) {
    return mapAdmin(current);
  }

  values.push(adminId);
  const result = await query(
    `UPDATE admins SET ${updates.join(', ')} WHERE admin_id = $${idx}
     RETURNING ${ADMIN_SELECT}`,
    values
  );

  return mapAdmin(result.rows[0]);
}

export async function updateAdminById(adminId, fields) {
  const current = await findAdminById(adminId);
  if (!current) {
    throw new AppError('User not found', 404);
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (!name) throw new AppError('Full name is required', 400);
    updates.push(`name = $${idx++}`);
    values.push(name);
  }

  if (fields.username !== undefined) {
    const normalized = normalizeUsername(fields.username);
    const existing = await query(
      `SELECT admin_id FROM admins WHERE LOWER(username) = $1 AND admin_id <> $2 LIMIT 1`,
      [normalized, adminId]
    );
    if (existing.rows[0]) {
      throw new AppError('This username is already taken', 409);
    }
    updates.push(`username = $${idx++}`);
    values.push(normalized);
  }

  if (fields.email !== undefined) {
    const email = fields.email.trim().toLowerCase();
    if (!email) throw new AppError('Email is required', 400);
    const existing = await query(
      `SELECT admin_id FROM admins WHERE LOWER(email) = $1 AND admin_id <> $2 LIMIT 1`,
      [email, adminId]
    );
    if (existing.rows[0]) {
      throw new AppError('This email is already in use', 409);
    }
    updates.push(`email = $${idx++}`);
    values.push(email);
  }

  if (fields.phoneNumber !== undefined) {
    updates.push(`phone_number = $${idx++}`);
    values.push(fields.phoneNumber.trim() || null);
  }

  if (fields.password) {
    if (fields.password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    const passwordHash = await bcrypt.hash(fields.password, 12);
    updates.push(`password_hash = $${idx++}`);
    values.push(passwordHash);
  }

  if (updates.length === 0) {
    return mapAdmin(current);
  }

  values.push(adminId);
  const result = await query(
    `UPDATE admins SET ${updates.join(', ')} WHERE admin_id = $${idx}
     RETURNING ${ADMIN_SELECT}`,
    values
  );

  return mapAdmin(result.rows[0]);
}

export async function archiveAdmin(adminId, requesterId) {
  if (adminId === requesterId) {
    throw new AppError('You cannot archive your own account', 400);
  }

  const current = await findAdminById(adminId);
  if (!current) {
    throw new AppError('User not found', 404);
  }

  if (current.status === 'Archived') {
    return mapAdmin(current);
  }

  const result = await query(
    `UPDATE admins SET status = 'Archived' WHERE admin_id = $1
     RETURNING ${ADMIN_SELECT}`,
    [adminId]
  );

  return mapAdmin(result.rows[0]);
}

export async function deleteAdmin(adminId, requesterId) {
  if (adminId === requesterId) {
    throw new AppError('You cannot delete your own account', 400);
  }

  const current = await findAdminById(adminId);
  if (!current) {
    throw new AppError('User not found', 404);
  }

  const result = await query(
    `DELETE FROM admins WHERE admin_id = $1 RETURNING ${ADMIN_SELECT}`,
    [adminId]
  );

  return mapAdmin(result.rows[0]);
}

export async function createAdmin(fields) {
  const name = (fields.name || '').trim();
  if (!name) throw new AppError('Full name is required', 400);

  const username = normalizeUsername(fields.username || '');
  if (!username) throw new AppError('Username is required', 400);

  const email = (fields.email || '').trim().toLowerCase();
  if (!email) throw new AppError('Email is required', 400);

  if (!fields.password || fields.password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // uniqueness checks
  const existingUser = await query(`SELECT admin_id FROM admins WHERE LOWER(username) = $1 LIMIT 1`, [username]);
  if (existingUser.rows[0]) {
    throw new AppError('This username is already taken', 409);
  }

  const existingEmail = await query(`SELECT admin_id FROM admins WHERE LOWER(email) = $1 LIMIT 1`, [email]);
  if (existingEmail.rows[0]) {
    throw new AppError('This email is already in use', 409);
  }

  const passwordHash = await bcrypt.hash(fields.password, 12);

  const result = await query(
    `INSERT INTO admins (name, username, email, phone_number, role, password_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'Active') RETURNING ${ADMIN_SELECT}`,
    [name, username, email, fields.phoneNumber || null, fields.role || 'Staff', passwordHash]
  );

  return mapAdmin(result.rows[0]);
}
