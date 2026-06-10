-- Migration: Add Test Papers schema
-- Description: Creates question_set_papers and candidate_test_papers tables and relevant indexes.

CREATE TABLE IF NOT EXISTS question_set_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
    questions JSONB NOT NULL,
    project_task TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_test_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    questions JSONB NOT NULL,
    project_task TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_question_set_papers_job_id ON question_set_papers(job_id);
CREATE INDEX IF NOT EXISTS idx_question_set_papers_position_id ON question_set_papers(position_id);
CREATE INDEX IF NOT EXISTS idx_candidate_test_papers_candidate_id ON candidate_test_papers(candidate_id);
