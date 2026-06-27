-- Credit payment ledger + remove product soft-archive.
-- Run in Supabase SQL Editor after reviewing each change.

-- 1) Permanent payment ledger (never store remaining_credit)
CREATE TABLE IF NOT EXISTS credit_history (
  credit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_id uuid NOT NULL REFERENCES sales_records(sale_id) ON DELETE CASCADE,
  payment_option text NOT NULL CHECK (payment_option IN ('Fully Paid', 'Credit')),
  balance_paid numeric(10,2) NOT NULL DEFAULT 0 CHECK (balance_paid >= 0),
  date_paid timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_history_sales_id ON credit_history(sales_id);
CREATE INDEX IF NOT EXISTS idx_credit_history_date_paid ON credit_history(date_paid);

-- 2) Remove product archive (permanent delete replaces soft-archive)
ALTER TABLE lpg_products DROP COLUMN IF EXISTS is_archived;
DROP INDEX IF EXISTS idx_lpg_products_archived;
