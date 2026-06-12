-- Migration to create candidate_test_paper_histories table
CREATE TABLE IF NOT EXISTS candidate_test_paper_histories (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    questions JSONB NOT NULL,
    project_task TEXT NOT NULL,
    task_file_path TEXT,
    task_skills JSONB,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_candidate_test_paper_histories_candidate_id ON candidate_test_paper_histories(candidate_id);
