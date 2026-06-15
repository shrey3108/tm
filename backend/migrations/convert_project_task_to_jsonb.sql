-- backend/migrations/convert_project_task_to_jsonb.sql
-- Convert question_set_papers
ALTER TABLE question_set_papers
ALTER COLUMN project_task TYPE jsonb 
USING CASE 
    WHEN project_task = '' THEN '[]'::jsonb 
    WHEN project_task IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(project_task) 
END;

-- Convert candidate_test_papers
ALTER TABLE candidate_test_papers
ALTER COLUMN project_task TYPE jsonb 
USING CASE 
    WHEN project_task = '' THEN '[]'::jsonb 
    WHEN project_task IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(project_task) 
END;

-- Convert candidate_test_paper_histories
ALTER TABLE candidate_test_paper_histories
ALTER COLUMN project_task TYPE jsonb 
USING CASE 
    WHEN project_task = '' THEN '[]'::jsonb 
    WHEN project_task IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(project_task) 
END;
