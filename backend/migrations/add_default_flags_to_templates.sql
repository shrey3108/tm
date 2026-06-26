
-- Migration: Add default flags to stage_templates
-- Created: 2026-04-30

-- 1. Add columns
ALTER TABLE stage_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE stage_templates ADD COLUMN IF NOT EXISTS default_order INTEGER;

-- 2. Update existing templates to match the requested defaults
UPDATE stage_templates SET is_default = TRUE, default_order = 2 WHERE name = 'HR Screening Round';
UPDATE stage_templates SET is_default = TRUE, default_order = 3 WHERE name = 'Technical Practical Round';
UPDATE stage_templates SET is_default = TRUE, default_order = 4 WHERE name = 'Technical + HR Panel Evaluation';
