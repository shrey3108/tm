-- Migration: Add DBD fields to associate_evaluations
-- Description: Makes test_paper_id nullable and adds fields for the DBD form (Dynamic Background/Decision).

-- 1. Make test_paper_id nullable since DBD forms do not require a question paper
ALTER TABLE associate_evaluations ALTER COLUMN test_paper_id DROP NOT NULL;

-- 2. Add DBD specific fields
ALTER TABLE associate_evaluations ADD COLUMN IF NOT EXISTS dbd_scores JSONB;
ALTER TABLE associate_evaluations ADD COLUMN IF NOT EXISTS dbd_hiring_decision TEXT;
ALTER TABLE associate_evaluations ADD COLUMN IF NOT EXISTS dbd_remarks TEXT;
