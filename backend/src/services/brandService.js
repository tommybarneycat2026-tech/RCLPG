import { query } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

// Returns every known brand name, alphabetically. This list powers every
// brand-selection UI in the app (product form, filters, overviews, sale
// forms) so a brand only ever needs to be created once.
export async function listBrands() {
  const result = await query(`SELECT name FROM brands ORDER BY name ASC`);
  return result.rows.map((row) => row.name);
}

// Explicitly registers a new brand. Rejects duplicates case-insensitively
// (e.g. "Regasco" vs "regasco" vs "REGASCO" are the same brand).
export async function createBrand(name) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new AppError('Brand name is required', 400);
  }

  const existing = await query(
    `SELECT name FROM brands WHERE LOWER(name) = LOWER($1)`,
    [trimmed]
  );
  if (existing.rows[0]) {
    throw new AppError(`Brand "${existing.rows[0].name}" already exists`, 409);
  }

  const result = await query(
    `INSERT INTO brands (name) VALUES ($1) RETURNING brand_id, name`,
    [trimmed]
  );
  return result.rows[0];
}

// Ensures a brand exists (case-insensitive match), creating it if it's new.
// Returns the canonical stored name so every product/sale record re-uses
// consistent casing instead of splintering into near-duplicate brands.
export async function ensureBrand(name, client = null) {
  const runner = client ? client.query.bind(client) : query;
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new AppError('Brand is required', 400);
  }

  const existing = await runner(
    `SELECT name FROM brands WHERE LOWER(name) = LOWER($1)`,
    [trimmed]
  );
  if (existing.rows[0]) {
    return existing.rows[0].name;
  }

  const inserted = await runner(
    `INSERT INTO brands (name) VALUES ($1) RETURNING name`,
    [trimmed]
  );
  return inserted.rows[0].name;
}
