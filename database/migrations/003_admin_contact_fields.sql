-- Add email and phone_number to admins for profile and user management.
-- Run in Supabase SQL Editor after 002_auth_username.sql.
--
-- Auth impact: Login remains username-based. Email is for profile/contact only.

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone_number text;

-- Backfill missing emails so existing rows stay functional and uniqueness can be enforced.
-- Placeholder domain allows admins to update to real addresses later.
UPDATE admins
SET email = LOWER(username) || '@pending.rclpg.local'
WHERE email IS NULL OR TRIM(email) = '';

-- Resolve duplicate backfill emails (unlikely but safe)
WITH numbered AS (
  SELECT admin_id, email,
         ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at NULLS LAST, admin_id) AS rn
  FROM admins
  WHERE email IS NOT NULL AND TRIM(email) <> ''
)
UPDATE admins a
SET email = n.email || '+' || n.rn
FROM numbered n
WHERE a.admin_id = n.admin_id AND n.rn > 1;

-- Unique email per user (case-insensitive); login still uses username index
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email_lower ON admins (LOWER(email));

-- Optional lookup index for phone (not unique — shared numbers possible)
CREATE INDEX IF NOT EXISTS idx_admins_phone_number ON admins (phone_number)
  WHERE phone_number IS NOT NULL AND TRIM(phone_number) <> '';
