-- Migration: Add job_stage_config_id to candidate_test_papers and candidate_test_paper_histories
-- Description: Adds job_stage_config_id column, modifies uniqueness constraints, and performs a best-effort backfill.
-- Created: 2026-06-25

-- 1. Add job_stage_config_id column to candidate_test_papers
ALTER TABLE candidate_test_papers ADD COLUMN IF NOT EXISTS job_stage_config_id UUID REFERENCES job_stage_configs(id) ON DELETE CASCADE;

-- 2. Add job_stage_config_id column to candidate_test_paper_histories
ALTER TABLE candidate_test_paper_histories ADD COLUMN IF NOT EXISTS job_stage_config_id UUID REFERENCES job_stage_configs(id) ON DELETE CASCADE;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidate_test_papers_job_stage_config_id ON candidate_test_papers(job_stage_config_id);
CREATE INDEX IF NOT EXISTS idx_candidate_test_paper_histories_job_stage_config_id ON candidate_test_paper_histories(job_stage_config_id);

-- 4. Drop the old unique candidate_id constraint on candidate_test_papers
ALTER TABLE candidate_test_papers DROP CONSTRAINT IF EXISTS candidate_test_papers_candidate_id_key;

-- 5. Add new composite unique constraint on (candidate_id, job_stage_config_id)
-- Allow a candidate to have at most one test paper per stage config
ALTER TABLE candidate_test_papers DROP CONSTRAINT IF EXISTS uq_candidate_stage_paper;
ALTER TABLE candidate_test_papers ADD CONSTRAINT uq_candidate_stage_paper UNIQUE (candidate_id, job_stage_config_id);

-- 6. Add unique index for job-level default papers (candidate_id is null)
-- Allow at most one default test paper per job per stage config
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_job_stage_default_paper ON candidate_test_papers (job_id, job_stage_config_id) WHERE candidate_id IS NULL;

-- 7. Backfill existing candidate_test_papers with matching job_stage_config_id
UPDATE candidate_test_papers ctp
SET job_stage_config_id = (
    SELECT cs.job_stage_id
    FROM candidate_stages cs
    JOIN job_stage_configs jsc ON cs.job_stage_id = jsc.id
    JOIN stage_templates st ON jsc.template_id = st.id
    WHERE cs.candidate_id = ctp.candidate_id 
      AND (st.name ILIKE '%Coding%' OR st.name ILIKE '%Practical%' OR st.name ILIKE '%Technical%')
    LIMIT 1
)
WHERE ctp.candidate_id IS NOT NULL AND ctp.job_stage_config_id IS NULL;

-- For job-level default test papers (candidate_id is NULL)
UPDATE candidate_test_papers ctp
SET job_stage_config_id = (
    SELECT jsc.id
    FROM job_stage_configs jsc
    JOIN stage_templates st ON jsc.template_id = st.id
    WHERE jsc.job_id = ctp.job_id 
      AND (st.name ILIKE '%Coding%' OR st.name ILIKE '%Practical%' OR st.name ILIKE '%Technical%')
    ORDER BY jsc.stage_order ASC
    LIMIT 1
)
WHERE ctp.candidate_id IS NULL AND ctp.job_stage_config_id IS NULL;

-- 8. Backfill existing histories
UPDATE candidate_test_paper_histories ctph
SET job_stage_config_id = (
    SELECT cs.job_stage_id
    FROM candidate_stages cs
    JOIN job_stage_configs jsc ON cs.job_stage_id = jsc.id
    JOIN stage_templates st ON jsc.template_id = st.id
    WHERE cs.candidate_id = ctph.candidate_id 
      AND (st.name ILIKE '%Coding%' OR st.name ILIKE '%Practical%' OR st.name ILIKE '%Technical%')
    LIMIT 1
)
WHERE ctph.job_stage_config_id IS NULL;
