-- Add task columns to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS task_file_path TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS task_skills JSONB;
