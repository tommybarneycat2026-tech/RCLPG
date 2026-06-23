-- Switch admin authentication from email to username.
-- Run in Supabase SQL Editor after 001_minimal_schema_additions.sql.

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS username text;

-- Backfill from email if present (part before @), otherwise skip
UPDATE admins
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'))
WHERE username IS NULL AND email IS NOT NULL AND email <> '';

UPDATE admins
SET username = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9_]', '', 'g'))
WHERE username IS NULL OR username = '';

-- Resolve duplicate backfill values
WITH numbered AS (
  SELECT admin_id, username,
         ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at) AS rn
  FROM admins
)
UPDATE admins a
SET username = n.username || '_' || n.rn
FROM numbered n
WHERE a.admin_id = n.admin_id AND n.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username_lower ON admins (LOWER(username));
