-- Migration to add question_bank_passing_threshold to jobs table
ALTER TABLE jobs ADD COLUMN question_bank_passing_threshold NUMERIC(5, 2) DEFAULT 70.0;
