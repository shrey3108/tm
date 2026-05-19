-- Migration: Add 'score' field to hr_decisions table
-- Description: Add optional score field (out of 5) for HR decisions
-- Created: 2026-05-19

-- Add the score column to hr_decisions table
ALTER TABLE hr_decisions 
ADD COLUMN IF NOT EXISTS score INTEGER;

-- Add comment to describe the new column
COMMENT ON COLUMN hr_decisions.score IS 'Optional score/rating out of 5 for HR decisions.';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully: Added score field to hr_decisions table';
END $$;
