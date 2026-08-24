-- Migration: Add designation to associates
-- Description: Adds a designation string column to allow roles like HR, CTO, DEV.

ALTER TABLE associates ADD COLUMN IF NOT EXISTS designation VARCHAR(255);
UPDATE associates SET designation = 'Interviewer' WHERE designation IS NULL;
