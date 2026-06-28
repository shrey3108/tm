/**
 * Type definitions for candidate hiring timelines.
 * Matches backend schemas in timeline.py.
 */

export interface AssociateMarkEntry {
  /** A single associate's weighted evaluation result for a stage. */
  associate_name: string;
  marks?: number | null;
}

export interface TimelineEvent {
  /** Event type: 'stage' or 'decision' */
  event_type: string;
  event_date?: string | null;
  title: string;
  description?: string | null;
  result?: string | null;
  ai_result?: string | null;
  hr_decision?: string | null;
  score?: number | null;
  ai_score?: number | null;
  hr_score?: number | null;
  stage_id?: string | null;
  stage_name?: string | null;
  job_id?: string | null;
  job_stage_config_id?: string | null;
  metadata?: Record<string, any> | null;
  /** Associate evaluation marks (name: marks out of 5) for github+question round stages */
  associate_marks: AssociateMarkEntry[];
}

export interface HiringTimelineResponse {
  candidate_id: string;
  latest_decision: string;
  current_stage: string;
  events: TimelineEvent[];
}
