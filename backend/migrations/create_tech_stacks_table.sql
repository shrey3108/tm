-- Migration: Create tech_stacks and job_tech_stacks tables
-- Description: Creates tech_stacks table and the junction table for jobs relationship.
-- Created: 2026-06-21

-- 1. Create tech_stacks table
CREATE TABLE IF NOT EXISTS tech_stacks (
    id          UUID PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE  tech_stacks             IS 'Technology stack lookup table (e.g. MERN, Python/FastAPI).';
COMMENT ON COLUMN tech_stacks.name        IS 'Unique name of the tech stack.';
COMMENT ON COLUMN tech_stacks.description IS 'Optional description of the tech stack.';

-- 2. Create job_tech_stacks junction table
CREATE TABLE IF NOT EXISTS job_tech_stacks (
    job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    tech_stack_id UUID NOT NULL REFERENCES tech_stacks(id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, tech_stack_id)
);

COMMENT ON TABLE job_tech_stacks IS 'Junction table for many-to-many relationship between jobs and tech_stacks.';

-- 3. Create index for faster joins
CREATE INDEX IF NOT EXISTS idx_job_tech_stacks_tech_stack_id ON job_tech_stacks(tech_stack_id);
CREATE INDEX IF NOT EXISTS idx_job_tech_stacks_job_id ON job_tech_stacks(job_id);
