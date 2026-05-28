-- Add task columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS task_file_path TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS task_skills JSONB;
