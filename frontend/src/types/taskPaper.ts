/**
 * TypeScript types for Predefined Question Set Papers and Candidate Assignments.
 */

export interface QuestionSetPaperRead {
  id: string;
  name: string;
  job_id: string;
  position_id: string;
  questions: string[];
  project_task: string[];
  task_file_path: string | null;
  task_skills: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateTestPaperRead {
  id: string;
  candidate_id: string;
  job_id: string;
  position_id: string;
  name: string;
  questions: string[];
  project_task: string[];
  task_file_path: string | null;
  task_skills: string[] | null;
  email_sent_count?: number;
  created_at: string;
}

export interface CandidateTestPaperAssign {
  candidate_id?: string;
  job_id?: string;
  position_id?: string;
  source_paper_ids?: string[]
  mode: "predefined" | "random" | "custom";
  paper_id?: string;
  questions?: string[];
  project_task?: string;
}

export interface CandidateTestPaperEmailSend {
  candidate_email: string;
  paper_id: string;
  force?: boolean;
}

export interface CandidateTestPaperBulkEmailSend {
  candidate_ids?: string[];
  candidate_emails?: string[];
  paper_id: string;
  force?: boolean;
}

export interface JobCandidateSkillsRead {
  job_skills: string[];
  task_skills: string[];
}
