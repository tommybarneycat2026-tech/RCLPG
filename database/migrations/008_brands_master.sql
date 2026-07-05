-- Dynamic brand master list.
-- Brands were previously a hardcoded list (Regasco, Seagas, Pryce) baked
-- into application code. This table lets staff add new brands from the
-- Inventory "Add New Product" form, with the new brand instantly available
-- everywhere brands are selected (filters, overviews, dropdowns).
-- Run in Supabase SQL Editor after reviewing.

CREATE TABLE IF NOT EXISTS brands (
  brand_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Case-insensitive uniqueness: "Regasco", "regasco", "REGASCO" are the same brand.
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_name_lower ON brands (LOWER(name));

-- Seed the brands that used to be hardcoded.
INSERT INTO brands (name)
VALUES ('Regasco'), ('Seagas'), ('Pryce')
ON CONFLICT DO NOTHING;

-- Backfill any brand already used on existing products so nothing is lost.
INSERT INTO brands (name)
SELECT DISTINCT TRIM(p.brand)
FROM lpg_products p
WHERE TRIM(p.brand) <> ''
ON CONFLICT DO NOTHING;

-- The customer's returned LPG tank variant was restricted to a fixed
-- CHECK constraint (Regasco/Seagas/Pryce). Brands are now validated at the
-- application layer against the `brands` table, so the fixed constraint
-- would block newly created brands and must be dropped. The constraint
-- name is looked up dynamically (instead of assuming Postgres' default
-- naming convention) so this migration is safe regardless of how it was
-- originally named.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'sales_records'
    AND att.attname = 'lpg_tank_variant'
    AND con.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sales_records DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Frequent lookups/filters/group-by on brand justify an index now that the
-- brand list (and therefore cardinality/usage) is expected to grow.
CREATE INDEX IF NOT EXISTS idx_lpg_products_brand ON lpg_products(brand);
