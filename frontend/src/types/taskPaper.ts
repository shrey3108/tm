import type { SkillRead } from "./admin";

/**
 * TypeScript types for Predefined Question Set Papers and Candidate Assignments.
 */

export interface MCQItem {
  question: string;
  options: string[];
  answer: string;
}

export interface TaskItem {
  task: string;
  instructions: string;
  prerequisites: string[];
}

export interface QuestionSetPaperRead {
  id: string;
  name: string;
  department_id: string;
  position_id: string;
  skills: SkillRead[];
  paper_type: string;
  questions: string[];
  mcqs: MCQItem[];
  project_task: (TaskItem | string)[];
  task_file_path: string | null;
  task_skills: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionSetPaperListRead {
  data: QuestionSetPaperRead[];
  total: number;
}

export interface QuestionSetPaperCreate {
  department_id: string;
  position_id: string;
  skill_ids: string[];
  paper_type: "normal" | "mcq" | "task" | "mixed";
  questions: string[];
  mcqs?: MCQItem[];
  project_task: (TaskItem | string)[];
}


export interface CandidateTestPaperRead {
  id: string;
  candidate_id: string | null;
  job_id: string;
  position_id: string;
  name: string;
  questions: string[];
  mcqs: MCQItem[];
  project_task: (TaskItem | string)[];
  task_file_path: string | null;
  task_skills: string[] | null;
  email_sent_count?: number;
  created_at: string;
  job_default_paper_changed: boolean;
  job_default_paper_name: string | null;
  job_default_paper_id: string | null;
}

export interface CandidateTestPaperAssign {
  candidate_id?: string;
  job_id?: string;
  mode: "predefined" | "random" | "custom";
  paper_id?: string;
  source_paper_ids?: string[];
  base_paper_id?: string;
  questions?: string[];
  mcqs?: MCQItem[];
  project_task?: string;
  question_count?: number;
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

export interface CandidateTestPaperHistoryRead {
  id: string;
  candidate_id: string;
  job_id: string;
  name: string;
  questions: string[];
  mcqs: MCQItem[];
  project_task: (TaskItem | string)[];
  task_file_path: string | null;
  task_skills: string[] | null;
  assigned_at: string;
  user_id: string | null;
}

export interface TaskPaperPreviewResponse {
  questions: string[];
  mcqs: MCQItem[];
  project_task: string[];
}
