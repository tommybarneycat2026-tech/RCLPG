-- Acquisition/base cost per product (Cost of Goods Sold input).
-- Used together with expenses to calculate accurate Net Income:
--   Net Income = Total Sales Revenue - Cost of Goods Sold - Total Expenses
-- Run in Supabase SQL Editor after reviewing.

ALTER TABLE lpg_products
  ADD COLUMN IF NOT EXISTS initial_price numeric(10,2) NOT NULL DEFAULT 0
    CHECK (initial_price >= 0);

COMMENT ON COLUMN lpg_products.initial_price IS
  'Acquisition/base cost of the product. Used to compute Cost of Goods Sold (COGS) for Net Income reporting.';
