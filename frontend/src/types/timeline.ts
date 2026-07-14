/**
 * Type definitions for candidate hiring timelines.
 * Matches backend schemas in timeline.py.
 */

import type { Associate_Marks } from "./candidate";

export interface AssociateMarkEntry {
  /** A single associate's weighted evaluation result for a stage. */
  associate_name: string;
  marks?: number | null;
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
  hr_decision_notes?: string[]
}

export interface HiringTimelineResponse {
  candidate_id: string;
  latest_decision: string;
  current_stage: string;
  events: TimelineEvent[];
}
