-- Expenses tracking for operating costs and sales report net income.
-- Run in Supabase SQL Editor after reviewing.

CREATE TABLE IF NOT EXISTS expenses (
  expenses_id SERIAL PRIMARY KEY,
  expenses VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
