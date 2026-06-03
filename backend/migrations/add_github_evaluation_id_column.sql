-- Add github_evaluation_id column to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS github_evaluation_id UUID;
