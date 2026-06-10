-- Migration: Add task_file_path and task_skills to question_set_papers and candidate_test_papers
-- Description: Adds columns for task file storage and extracted task skills to the papers tables.

ALTER TABLE question_set_papers ADD COLUMN IF NOT EXISTS task_file_path TEXT;
ALTER TABLE question_set_papers ADD COLUMN IF NOT EXISTS task_skills JSONB;

ALTER TABLE candidate_test_papers ADD COLUMN IF NOT EXISTS task_file_path TEXT;
ALTER TABLE candidate_test_papers ADD COLUMN IF NOT EXISTS task_skills JSONB;
