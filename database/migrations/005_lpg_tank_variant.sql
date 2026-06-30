-- Customer returned empty cylinder brand on exchange sales.
-- Run in Supabase SQL Editor after reviewing.

ALTER TABLE sales_records
  ADD COLUMN IF NOT EXISTS lpg_tank_variant text
    CHECK (lpg_tank_variant IS NULL OR lpg_tank_variant IN ('Regasco', 'Seagas', 'Pryce'));

CREATE INDEX IF NOT EXISTS idx_sales_records_lpg_tank_variant ON sales_records(lpg_tank_variant);
