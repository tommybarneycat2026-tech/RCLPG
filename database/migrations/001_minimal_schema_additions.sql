-- Minimal schema additions required for RCLPG Portal functionality.
-- Run in Supabase SQL Editor after reviewing each change.

-- 1) Admin authentication (admins table has no credentials)
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS password_hash text;

-- 2) Sales financial fields (revenue, price type, reporting)
ALTER TABLE sales_records
  ADD COLUMN IF NOT EXISTS price_type text CHECK (price_type IN ('Regular Retail', 'Wholesale')),
  ADD COLUMN IF NOT EXISTS unit_price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) NOT NULL DEFAULT 0;

-- 3) Soft-archive inventory without deleting rows
ALTER TABLE lpg_products
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- 4) Password reset tokens (forgot password flow)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admins(admin_id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_admin ON password_reset_tokens(admin_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_date_created ON sales_records(date_created);
CREATE INDEX IF NOT EXISTS idx_lpg_products_archived ON lpg_products(is_archived);

-- Optional seed admin (replace password hash after running backend seed script)
-- INSERT INTO admins (name, role, status, username, password_hash)
-- VALUES ('System Admin', 'Administrator', 'Active', 'admin', '<bcrypt-hash>');
