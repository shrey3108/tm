-- =====================================================
-- Migration: Add Criterion Versioning System
-- Mirrors the job_versions pattern used for jobs.
-- =====================================================

-- 1. Add version column to criteria table (IF NOT EXISTS supported in PG 9.6+)
ALTER TABLE criteria ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 2. Create criterion_versions table
CREATE TABLE IF NOT EXISTS criterion_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criterion_id UUID NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    prompt_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_criterion_versions_criterion_id ON criterion_versions(criterion_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_criterion_versions_unique ON criterion_versions(criterion_id, version_number);

-- 4. Back-fill version 1 snapshot for all existing criteria that have no snapshot yet
INSERT INTO criterion_versions (id, criterion_id, version_number, name, description, prompt_text, created_at)
SELECT
    gen_random_uuid(),
    c.id,
    1,
    c.name,
    c.description,
    c.prompt_text,
    c.created_at
FROM criteria c
WHERE NOT EXISTS (
    SELECT 1 FROM criterion_versions cv WHERE cv.criterion_id = c.id
)
