-- Migration: Alter score column to FLOAT in hr_decisions table
-- Description: Changes the score column from INTEGER to FLOAT to support decimal ratings (e.g., 3.5).

ALTER TABLE hr_decisions ALTER COLUMN score TYPE FLOAT;
