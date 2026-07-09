/**
 * Admin API related TypeScript types.
 * Based on the backend Pydantic schemas in app/v1/schemas/admin.py.
 */

import type { Job, JobCandidatesStats, JobPipelineStats } from "@/types/job";
import type { JobStageConfig, CandidateStageSummary } from "@/types/stage";
import type { SkillRead } from "./skill";

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}


/**
 * Audit log entry for tracking admin actions.
 */
export interface AuditLogRead {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Recent file upload record.
 */
export interface RecentUploadRead {
  id: string;
  file_name?: string;
  file_type?: string;
  size?: number;
  candidate_id?: string;
  candidate_name?: string;
  job_id?: string;
  uploaded_by: string;
  uploader_name?: string;
  created_at?: string;
}


/**
 * Summary of platform analytics.
 */
export interface AnalyticsSummary {
  total_users: number;
  total_roles: number;
  total_permissions: number;
  total_jobs: number;
  total_candidates: number;
  total_resumes: number;
  total_passed: number;
  total_failed: number;
  total_pending: number;
  total_unprocessed: number;
  active_jobs: number;
  active_users: number;
  passed_count: number;
  maybe_count: number;
  failed_count: number;
  hr_decision_count: number;
  pending_decision_count: number;
}

/**
 * Detailed hiring report with statistics.
 */
export interface HiringReport {
  total_jobs: number;
  active_jobs: number;
  total_candidates: number;
  total_passed: number;
  total_failed: number;
  total_pending: number;
  total_unprocessed: number;
  candidates_by_job: JobCandidatesStats[];
  job_pipeline_stats: JobPipelineStats[];
  resumes_uploaded_last_30_days: number;
  average_resume_score?: number;
  hr_decided_count: number;
  pending_count: number;
}


/**
 * Location Management Types
 */

/**
 * Location returned from read operations.
 */
export interface LocationRead {
  id: string;
  name: string;
}

import type { StageTemplateCreateFormValues, StageTemplateUpdateFormValues } from "@/schemas/stageTemplate";

/**
 * Stage Template Management Types
 */

/**
 * Payload for creating a new stage template.
 */
export type StageTemplateCreate = StageTemplateCreateFormValues;

/**
 * Payload for updating an existing stage template.
 */
export type StageTemplateUpdate = StageTemplateUpdateFormValues;

/**
 * Job Stage Configuration Types
 */

/**
 * Payload for adding a stage to a job.
 */
export interface JobStageConfigCreate {
  template_id: string;
  stage_order: number;
  config?: Record<string, any>;
  is_mandatory?: boolean;
}

/**
 * Payload for updating a job-specific stage configuration.
 */
export interface JobStageConfigUpdate {
  stage_order?: number;
  config?: Record<string, any>;
  is_mandatory?: boolean;
}

/**
 * Payload for reordering stages within a job.
 */
export interface JobStageReorder {
  stage_ids: string[];
}

/**
 * Job returned from read operations.
 */
export interface JobRead extends Omit<Job, "skills"> {
  skills?: SkillRead[];
  stages?: JobStageConfig[];
}

/**
 * Detailed AI analysis of a resume.
 */
export interface CandidateMatchAnalysis {
  match_percentage: number;
  skill_gap_analysis: string;
  experience_alignment: string;
  strength_summary: string;
  missing_skills?: { name: string; score: number }[];
  extraordinary_points?: string[];
  custom_extractions?: any;
}

/**
 * Historical analysis/screening result for a candidate for a specific JD version.
 */
export interface CandidateVersionResult {
  id: string;
  resume_id: string;
  job_id: string;
  job_version_number: number;
  resume_score: number | null;
  pass_fail: string | null;
  analysis_data: CandidateMatchAnalysis | null;
  analyzed_at: string | null;
}

/**
 * Result of a candidate analysis/screening for a single candidate.
 */
export interface CandidateAnalysis {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  current_status?: string;
  resume_score?: number;
  pass_fail?: string | boolean | null;
  resume_analysis?: CandidateMatchAnalysis | null;
  resume_id?: string;
  created_at: string;
  is_parsed?: boolean;
  processing_status?: string;
  processing_error?: string | null;
  hr_decision?: "approve" | "reject" | "may be" | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  /**
   * Candidate's location (city, country, etc.).
   * May be null/undefined if not extracted — render as "N/A".
   */
  location?: string | null;
  /**
   * Timestamp when the HR uploaded the candidate's resume.
   * Falls back to created_at when not provided — render as "N/A" if both are absent.
   */
  applied_at?: string | null;
  /**
   * The JD version number at which this candidate's resume was last analyzed.
   * Compare against job.version to determine if reanalysis is needed.
   * null/undefined means it has never been successfully analyzed.
   */
  applied_version_number?: number | null;
  /**
   * Historical screening results for previous/all JD versions.
   */
  version_results?: CandidateVersionResult[] | null;
  /**
   * Current recruitment stage information.
   */
  current_stage?: CandidateStageSummary | null;
  /**
   * Full recruitment pipeline for this candidate.
   */
  pipeline?: CandidateStageSummary[] | null;
  task_file_path?: string | null;
  test_email_sent?: boolean;

  email_sent_count?: number
}

/**
 * Response containing all candidate analysis results for a job.
 */
export interface CandidateAnalysisResponse {
  data: CandidateAnalysis[];
  total: number;
}

/**
 * Detailed AI analysis of a resume.
 */
export interface PromptRead {
  name: string;
  content: string;
  stage: string
}

/**
 * AI resume-screening pass/fail breakdown for a job.
 */
export interface JobResultStats {
  passed: number;
  failed: number;
  pending: number;
}

/**
 * HR decision summary for a job.
 */
export interface JobHRDecisionStats {
  total_candidates: number;
  passed: number;
  failed: number;
  maybe: number;
  pending: number;
  undecidedCount: number;
}

export interface PriorityTimeline {
  name: string,
  start_date: string,
  due_date: string,
  days_total: number,
  days_elapsed: number,
  days_remaining: number,
  progress_pct: number,
  status: string,
}
/**
 * Comprehensive statistics for a specific job.
 */
export interface JobStatsResponse {
  result: JobResultStats;
  location: Record<string, number>;
  stages: Record<string, number>;
  hr_decisions: JobHRDecisionStats;
  priority_timeline: PriorityTimeline
  stage_details: Record<string, {
    hr_decisions: Record<string, number>;
    ai_results: JobResultStats;
  }>;
}
