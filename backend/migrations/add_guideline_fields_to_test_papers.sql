-- Migration: Add guideline fields to candidate test papers
-- Description: Adds guideline_id and guideline_content columns.

ALTER TABLE candidate_test_papers
ADD COLUMN IF NOT EXISTS guideline_id UUID REFERENCES guidelines(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS guideline_content TEXT;

ALTER TABLE candidate_test_paper_histories
ADD COLUMN IF NOT EXISTS guideline_id UUID REFERENCES guidelines(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS guideline_content TEXT;
