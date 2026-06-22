-- Drop job_tech_stacks table
DROP TABLE IF EXISTS job_tech_stacks CASCADE;

-- Drop tech_stacks table
DROP TABLE IF EXISTS tech_stacks CASCADE;

-- Drop tech_stack_id column from question_set_papers
ALTER TABLE question_set_papers DROP COLUMN IF EXISTS tech_stack_id CASCADE;

-- Create question_set_paper_skills join table
CREATE TABLE IF NOT EXISTS question_set_paper_skills (
    question_set_paper_id UUID NOT NULL,
    skill_id UUID NOT NULL,
    PRIMARY KEY (question_set_paper_id, skill_id),
    CONSTRAINT fk_question_set_paper FOREIGN KEY (question_set_paper_id) REFERENCES question_set_papers (id) ON DELETE CASCADE,
    CONSTRAINT fk_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE
);
