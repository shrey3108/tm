import type { SkillRead } from "./skill";

/**
 * TypeScript types for Predefined Question Set Papers and Candidate Assignments.
 */

export interface MCQItem {
  question: string;
  options: string[];
  answer: string;
  marks?: number;
  duration?: number; // in minutes
  skill_ids?: string[];
}

export interface QuestionItem {
  question: string;
  marks?: number;
  duration?: number; // in minutes
  skill_ids?: string[];
}

export interface SubTaskItem {
  name: string;
  description?: string;
  marks?: number;
}

export interface TaskItem {
  // Old fields for backward compatibility
  task?: string;
  instructions?: string;

  // New nested fields
  title?: string;
  description?: string;
  duration?: number; // in minutes
  tasks?: SubTaskItem[];
  skill_ids?: string[];

  // Legacy / UI computed values
  total_marks?: number;
  total_duration?: number;
}

export interface QuestionSetPaperRead {
  id: string;
  name: string;
  department_id: string;
  position_id: string;
  skills: SkillRead[];
  paper_type: string;
  questions: (QuestionItem | string)[];
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
  questions: (QuestionItem | string)[];
  mcqs?: MCQItem[];
  project_task: (TaskItem | string)[];
}

export interface CandidateTestPaperRead {
  id: string;
  candidate_id: string | null;
  job_id: string;
  position_id: string;
  job_stage_config_id?: string | null;
  name: string;
  questions: (QuestionItem)[];
  mcqs: MCQItem[];
  project_task: (TaskItem)[];
  task_file_path: string | null;
  task_skills: string[] | null;
  email_sent_count?: number;
  created_at: string;
  job_default_paper_changed: boolean;
  job_default_paper_name: string | null;
  job_default_paper_id: string | null;
  guideline_id: string | null;
  guideline_content: string | null;
}

export interface SourceMixItem {
  paper_id: string;
  question_indices: number[];
  mcq_indices: number[];
  task_indices: number[];
}

export interface CandidateTestPaperAssign {
  candidate_id?: string;
  job_id?: string;
  job_stage_id?: string;
  mode: "predefined" | "random" | "custom" | "hybrid";
  paper_id?: string;
  source_paper_ids?: string[];
  base_paper_id?: string;
  guideline_id?: string;
  questions?: (QuestionItem | string)[];
  mcqs?: MCQItem[];
  project_task?: (TaskItem | string)[];
  question_count?: number;
  source_mix?: SourceMixItem[];
  custom_skills?: string[];
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
  job_stage_config_id?: string | null;
  name: string;
  questions: (QuestionItem | string)[];
  mcqs: MCQItem[];
  project_task: (TaskItem | string)[];
  task_file_path: string | null;
  task_skills: string[] | null;
  assigned_at: string;
  user_id: string | null;
}

export interface TaskPaperPreviewResponse {
  questions: (QuestionItem | string)[];
  mcqs: MCQItem[];
  project_task: (TaskItem | string)[];
}
