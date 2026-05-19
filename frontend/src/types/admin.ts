/**
 * Admin API related TypeScript types.
 * Based on the backend Pydantic schemas in app/v1/schemas/admin.py.
 */

import type { Job } from "@/types/job";
import type { JobStageConfig, CandidateStageSummary } from "@/types/stage";

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

/**
 * Base fields for a permission.
 */
export interface PermissionBase {
  name: string;
  description: string;
}

/**
 * Permission returned from read operations.
 */
export interface PermissionRead extends PermissionBase {
  id: string;
  created_at?: string;
}

/**
 * Payload for creating a new permission.
 */
export interface PermissionCreate extends PermissionBase { }

/**
 * Base fields for a role.
 */
export interface RoleBase {
  name: string;
}

/**
 * Payload for creating a new role.
 */
export interface RoleCreate extends RoleBase {
  permission_ids?: string[];
}

/**
 * Payload for updating an existing role.
 */
export interface RoleUpdate {
  name?: string;
  permission_ids?: string[];
}

/**
 * Role returned from read operations.
 */
export interface RoleRead extends RoleBase {
  id: string;
  created_at?: string;
  updated_at?: string;
  user_count: number
}

/**
 * Role with its associated permissions.
 */
export interface RoleWithPermissions extends RoleRead {
  permissions: PermissionRead[];
}

/**
 * Payload for creating a new user via admin.
 */
export interface UserAdminCreate {
  email: string;
  password?: string;
  full_name?: string;
  is_active?: boolean;
  role_id: string;
}

/**
 * Payload for updating an existing user via admin.
 */
export interface UserAdminUpdate {
  full_name?: string;
  is_active?: boolean;
  role_id?: string;
}

/**
 * User returned from admin read operations.
 */
export interface UserAdminRead {
  id: string;
  full_name?: string;
  email: string;
  is_active: boolean;
  role_id: string;
  role_name: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * User with their role details included.
 */
export interface UserWithRole extends UserAdminRead {
  role: RoleRead;
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
 * Audit log entry with user details.
 */
export interface AuditLogWithUser extends AuditLogRead {
  user: UserAdminRead;
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
 * Recent upload with additional details.
 */
export interface RecentUploadWithDetails extends RecentUploadRead {
  candidate_name?: string;
  job_title?: string;
  uploader_email?: string;
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
 * Candidate statistics for a specific job.
 */
export interface JobCandidatesStats {
  job_id: string;
  job_title: string;
  department?: string | null;
  candidate_count: number;
}

export interface PipelineStageStats {
  stage_name: string;
  order: number;
  count: number;
}

export interface JobPipelineStats {
  stage?: string;
  job_names?: string[];
  [jobTitle: string]: any;
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
 * Job Management Types
 */

/**
 * Payload for creating a new job posting.
 */
export interface JobCreate {
  title: string;
  vacancy: number;
  department_id: string;
  jd_text: string;
  is_active?: boolean;
  skill_ids: string[];
  passing_threshold?: number;
  custom_extraction_fields?: string[];
  priority_id: string;
  position_id: string;
  priority_start_date?: string | null;
  priority_end_date?: string | null;
}

/**
 * Payload for updating an existing job posting.
 */
export interface JobUpdate {
  title?: string;
  vacancy?: number;
  department_id?: string;
  jd_text?: string;
  is_active?: boolean;
  skill_ids?: string[];
  passing_threshold?: number;
  custom_extraction_fields?: string[];
  priority_id?: string;
  position_id?: string;
  priority_start_date?: string | null;
  priority_end_date?: string | null;
}

/**
 * Skill Management Types
 */

/**
 * Base fields for a skill.
 */
export interface SkillBase {
  id: string;
  name: string;
  description?: string;
}

/**
 * Payload for creating a new skill.
 */
export interface SkillCreate extends Omit<SkillBase, "id"> { }

/**
 * Payload for updating an existing skill.
 */
export interface SkillUpdate extends Partial<SkillCreate> { }

/**
 * Skill returned from read operations.
 */
export interface SkillRead extends SkillBase { }

/**
 * Department Management Types
 */

/**
 * Shared fields for a department.
 */
export interface DepartmentBase {
  name: string;
  description?: string | null;
}

/**
 * Payload for creating a new department.
 */
export interface DepartmentCreate extends DepartmentBase { }

/**
 * Payload for updating an existing department.
 */
export interface DepartmentUpdate {
  name?: string;
  description?: string | null;
}

/**
 * Department returned from read operations.
 */
export interface DepartmentRead extends DepartmentBase {

  id: string;
}

/**
 * Job Priority Management Types
 */

/**
 * Job priority returned from read operations.
 */
export interface JobPriorityRead {
  id: string;
  name: string;
  duration_days: number;
  created_at: string;
  updated_at: string;
  assigned_jobs_count: number
}

/**
 * Payload for creating a new job priority.
 */
export interface JobPriorityCreate {
  duration_days: number;
}

/**
 * Payload for updating an existing job priority.
 */
export interface JobPriorityUpdate {
  duration_days?: number;
}

/**
 * Job Position Management Types
 */

/**
 * Job position returned from read operations.
 */
export interface JobPositionRead {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for creating a new job position.
 */
export interface JobPositionCreate {
  name: string;
}

/**
 * Payload for updating an existing job position.
 */
export interface JobPositionUpdate {
  name?: string;
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

/**
 * Stage Template Management Types
 */

/**
 * Payload for creating a new stage template.
 */
export interface StageTemplateCreate {
  name: string;
  description?: string;
  default_config?: Record<string, any>;
}

/**
 * Payload for updating an existing stage template.
 */
export interface StageTemplateUpdate {
  name?: string;
  description?: string;
  default_config?: Record<string, any>;
  is_default: boolean
}

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

/**
 * Criteria Management Types
 */

/**
 * Shared fields for an evaluation criterion.
 */
export interface CriterionBase {
  name: string;
  description?: string | null;
  prompt_text: string;
}

/**
 * Payload for creating a new evaluation criterion.
 */
export interface CriterionCreate extends CriterionBase { }

/**
 * Payload for updating an existing evaluation criterion.
 */
export interface CriterionUpdate {
  name?: string;
  description?: string | null;
  prompt_text?: string;
}

/**
 * Evaluation criterion returned from read operations.
 */
export interface CriterionRead extends CriterionBase {
  id: string;
  created_at: string;
}
