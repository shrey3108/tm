-- Migration: Alter question_set_papers table
-- Description: Replaces job_id with department_id and tech_stack_id.
-- Created: 2026-06-21

-- 1. Clear existing predefined papers to avoid null constraint violations on existing data
TRUNCATE TABLE question_set_papers CASCADE;

-- 2. Drop old job_id column
ALTER TABLE question_set_papers DROP COLUMN IF EXISTS job_id CASCADE;

-- 3. Add department_id and tech_stack_id columns
ALTER TABLE question_set_papers ADD COLUMN department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE question_set_papers ADD COLUMN tech_stack_id UUID NOT NULL REFERENCES tech_stacks(id) ON DELETE CASCADE;

-- 4. Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_question_set_papers_department_id ON question_set_papers(department_id);
CREATE INDEX IF NOT EXISTS idx_question_set_papers_tech_stack_id ON question_set_papers(tech_stack_id);
