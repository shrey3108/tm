-- Migration: Add paper_type and mcqs columns
-- Description: Adds paper_type and mcqs to predefined papers and candidate assigned test papers.
-- Created: 2026-06-21

ALTER TABLE question_set_papers ADD COLUMN IF NOT EXISTS paper_type VARCHAR(50) NOT NULL DEFAULT 'normal';
ALTER TABLE question_set_papers ADD COLUMN IF NOT EXISTS mcqs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE candidate_test_papers ADD COLUMN IF NOT EXISTS mcqs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE candidate_test_paper_histories ADD COLUMN IF NOT EXISTS mcqs JSONB NOT NULL DEFAULT '[]'::jsonb;
