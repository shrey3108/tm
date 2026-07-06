import type { JobStageConfig } from "@/types/stage";
import type { JobPositionRead } from "@/types/jobPosition";
import type { JobCreateFormValues, JobUpdateFormValues } from "@/schemas/job";
import type { JobPriorityRead } from "@/types/jobPriority";
import type { AssociateRead } from "@/types/associate";

/**
 * Represents a job posting in the hiring platform.
 * Contains job details, description, status information, and workflow metadata.
 */
export interface Job {
  /** Unique identifier for the job */
  id: string;
  /** Job title or position name */
  title: string;
  /** UUID of the department this job belongs to */
  department_id: string | null;
  /** Resolved department name (read-only, from relationship) */
  department_name: string | null;
  /** Full department object returned from the API */
  department?: { id: string; name: string; description: string | null } | null;
  /** Job description in plain text format */
  jd_text: string | null;
  /** Job description in structured JSON format */
  jd_json: Record<string, unknown> | null;
  /** Whether the job is currently accepting applications */
  is_active: boolean;
  /** Optional custom extraction fields used during resume parsing */
  custom_extraction_fields?: string[] | null;
  /** Threshold score (0-100) for considering a candidate as 'pass' */
  passing_threshold: number;
  question_bank_passing_threshold: number;
  /** Current active version number */
  version?: number;
  /** Total number of saved versions */
  total_versions?: number;
  /** Version history metadata */
  job_versions?: JobVersionMinimal[];
  /** Configured interview stages */
  stages?: JobStageConfig[];
  /** Backend-provided decision summary for the job */
  decision_summary?: JobDecisionSummary | null;
  /** Real-time automated screening summary from the backend */
  automated_screening_summary?: Record<string, any> | null;
  /** ID of the user who created the job posting */
  created_by: string;
  /** Timestamp when the job was created */
  created_at: string;
  /** Skills linked to the job */
  skills: { id: string; name: string; description?: string; default_weightage?: number }[];
  /** Associates linked to the job */
  associates?: AssociateRead[];
  job_skill_weightages?: Record<string, number> | null;

  total_candidates: number;
  current_session_candidates: number;
  activity_sessions?: JobActivitySession[] | null;
  vacancy: number | null;
  priority_id: string | null;
  associate_reminder_hours: number | null;
  priority_start_date: string | null;
  priority_end_date: string | null;
  priority?: JobPriorityRead | null;
  position_id: string;
  position?: JobPositionRead | null;
  processing_version?: number | null;
  message?: string | null;
  task_file_path?: string | null;
  task_skills?: string[] | null;
  send_ai_evaluation_to_associate: boolean;
}

export type JobCreate = JobCreateFormValues
export type JobUpdate = JobUpdateFormValues

export interface JobDecisionSummary {
  job_id: string;
  total_candidates: number;
  approved_count: number;
  reject_count: number;
  maybe_count: number;
  undecided_count: number;
}

export interface JobActivitySession {
  session_id: number;
  start_date: string;
  end_date: string | null;
  candidate_count: number;
  is_current: boolean;
  approved_count: number,
  rejected_count: number,
  pending_count: number
}

/**
 * Minimal job version metadata returned by the backend.
 */
export interface JobVersionMinimal {
  id: string;
  version_num: number;
}

export interface JobVersionDetail {
  id: string;
  job_id: string;
  version_number: number;
  title: string;
  jd_text: string | null;
  jd_json: Record<string, unknown> | null;
  custom_extraction_fields: string[] | null;
  created_at: string;
}

/**
 * Paginated response for job lists including global dashboard metrics.
 */
export interface JobsListResponse {
  data: Job[];
  total: number;
  global_decision_summary: Record<string, any> | null;
  global_screening_summary: Record<string, any> | null;
}


/**
 * Represents a job title.
 */
export interface JobTitle {
  id: string;
  title: string;
}

export interface JobTask {
  task_file_path: string | null;
  task_skills: string[] | null;
}

export interface DeleteJobTaskResponse {
  message: string;
}

export interface JobTitleVariant {
  job_id: string;
  position_id: string;
  position_name: string;
  is_active: boolean;
}

export interface JobTitleGroup {
  title: string;
  variants: JobTitleVariant[];
}

export interface JobTitlesGroupedListResponse {
  data: JobTitleGroup[];
}

/**
 * Candidate statistics for a specific job.
 */
export interface JobCandidatesStats {
  job_id: string;
  job_title: string;
  department?: string;
  candidate_count: number;
}

export interface JobPipelineStats {
  stage?: string;
  job_names?: string[];
  [jobTitle: string]: any;
}
