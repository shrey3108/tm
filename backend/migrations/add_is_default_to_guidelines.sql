-- 1. Add the is_default column to the guidelines table
ALTER TABLE guidelines ADD COLUMN is_default BOOLEAN DEFAULT FALSE NOT NULL;


