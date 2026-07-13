-- Fix roleAndPermission
ALTER TABLE "roleAndPermission" DROP CONSTRAINT IF EXISTS roleandpermission_permission_id_fkey;
ALTER TABLE "roleAndPermission" ADD CONSTRAINT roleandpermission_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

ALTER TABLE "roleAndPermission" DROP CONSTRAINT IF EXISTS roleandpermission_role_id_fkey;
ALTER TABLE "roleAndPermission" ADD CONSTRAINT roleandpermission_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

-- Fix hr_decisions
ALTER TABLE hr_decisions DROP CONSTRAINT IF EXISTS hr_decisions_candidate_id_fkey;
ALTER TABLE hr_decisions ADD CONSTRAINT hr_decisions_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;

ALTER TABLE hr_decisions DROP CONSTRAINT IF EXISTS hr_decisions_stage_config_id_fkey;
ALTER TABLE hr_decisions ADD CONSTRAINT hr_decisions_stage_config_id_fkey FOREIGN KEY (stage_config_id) REFERENCES job_stage_configs(id) ON DELETE SET NULL;

ALTER TABLE hr_decisions DROP CONSTRAINT IF EXISTS hr_decisions_user_id_fkey;
ALTER TABLE hr_decisions ADD CONSTRAINT hr_decisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE hr_decisions DROP CONSTRAINT IF EXISTS uq_hr_decision_cand_stage_user;
ALTER TABLE hr_decisions ADD CONSTRAINT uq_hr_decision_cand_stage_user UNIQUE (candidate_id, stage_config_id, user_id);

-- Fix interviews
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_candidate_id_fkey;
ALTER TABLE interviews ADD CONSTRAINT interviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;

ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_job_id_fkey;
ALTER TABLE interviews ADD CONSTRAINT interviews_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_user_id_fkey;
ALTER TABLE interviews ADD CONSTRAINT interviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Fix audit_logs
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Fix transcripts
ALTER TABLE transcripts DROP CONSTRAINT IF EXISTS transcripts_interview_id_fkey;
ALTER TABLE transcripts ADD CONSTRAINT transcripts_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE;

ALTER TABLE transcripts DROP CONSTRAINT IF EXISTS transcripts_file_id_fkey;
ALTER TABLE transcripts ADD CONSTRAINT transcripts_file_id_fkey FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL;

-- Fix resume_chunks
ALTER TABLE resume_chunks DROP CONSTRAINT IF EXISTS resume_chunks_resume_id_fkey;
ALTER TABLE resume_chunks ADD CONSTRAINT resume_chunks_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE;

-- Fix resumes
ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_candidate_id_fkey;
ALTER TABLE resumes ADD CONSTRAINT resumes_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;

ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_file_id_fkey;
ALTER TABLE resumes ADD CONSTRAINT resumes_file_id_fkey FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL;

-- Fix files
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_candidate_id_fkey;
ALTER TABLE files ADD CONSTRAINT files_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;

-- Fix candidate_stages
ALTER TABLE candidate_stages DROP CONSTRAINT IF EXISTS uq_cand_stage;
ALTER TABLE candidate_stages ADD CONSTRAINT uq_cand_stage UNIQUE (candidate_id, job_stage_id);

-- Fix evaluations
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS uq_eval_interview_stage;
ALTER TABLE evaluations ADD CONSTRAINT uq_eval_interview_stage UNIQUE (interview_id, candidate_stage_id);
