import type { CandidateStageSummary } from "./stage";

/**
 * Canonical candidate shape for table usage.
 * Both CandidateAnalysis and CandidateResponse satisfy this interface.
 */
export interface UnifiedCandidate {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  current_status?: string | null;
  resume_score?: number | null;
  pass_fail?: string | boolean | null;
  is_parsed?: boolean;
  processing_status?: string | null;
  hr_decision?: string | null;
  hr_score?: number | null;
  created_at: string;
  /** Explicit apply timestamp – falls back to created_at, then "N/A" */
  applied_at?: string | null;
  /** Location extracted from resume */
  location?: string | null;
  /** ID of the job the candidate applied for */
  applied_job_id?: string | null;
  job_name?: string | null;
  current_stage?: CandidateStageSummary | null;
  pipeline?: CandidateStageSummary[] | null;
  task_file_path?: string | null;
  email_sent_count?: number;
  test_email_sent?: boolean | null;
}

export interface Associate_Marks {
  associate_name: string;
  marks: number;
}

export interface TimelineEvent {
  event_type: "stage" | "decision";
  event_date: string | Date;
  title: string;
  description?: string | null;
  result?: string | null;
  score?: number | null;
  ai_score?: number;
  hr_score?: number;
  stage_id?: string | null;
  stage_name?: string | null;
  job_id?: string | null;
  job_stage_config_id?: string | null;
  ai_result?: string | null;
  hr_decision?: string | null;
  metadata?: Record<string, any> | null;
  associate_marks?: Associate_Marks[]
}

export interface HiringTimelineResponse {
  candidate_id: string;
  events: TimelineEvent[];
  latest_decision: string;
  current_stage: string
}
