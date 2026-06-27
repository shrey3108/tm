-- Migration: Create associate_evaluations table
-- Description: Creates the associate_evaluations table to track each associate's
-- evaluation assignment and submission for a candidate stage.

CREATE TABLE IF NOT EXISTS associate_evaluations (
    id                  UUID PRIMARY KEY,
    candidate_stage_id  UUID NOT NULL REFERENCES candidate_stages(id) ON DELETE CASCADE,
    associate_id        UUID NOT NULL REFERENCES associates(id) ON DELETE CASCADE,
    test_paper_id       UUID NOT NULL REFERENCES candidate_test_papers(id) ON DELETE CASCADE,
    candidate_id        UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id              UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    review_token        UUID NOT NULL UNIQUE,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at        TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'sent',
    marks               JSONB,
    total_marks         FLOAT,
    max_total_marks     FLOAT,
    result              TEXT
);

-- Index for fast lookups by candidate_stage_id (used by GET results endpoint)
CREATE INDEX IF NOT EXISTS idx_associate_evaluations_stage_id
    ON associate_evaluations(candidate_stage_id);

-- Index for fast lookups by review_token (used by form/submit endpoints)
CREATE INDEX IF NOT EXISTS idx_associate_evaluations_review_token
    ON associate_evaluations(review_token);
