/**
 * Type definitions for associate evaluation reviews and results.
 * Matches backend schemas in associate_review.py.
 */

export interface QuestionMark {
  /** Type of item: 'question', 'mcq', or 'task' */
  item_type: string;
  /** The question text */
  question_text: string;
  /** Maximum marks for this question */
  max_marks: number | null;
  /** Marks awarded by the associate */
  awarded_marks: number | null;
  /** Skill UUIDs (as strings) tagged on this item, used for weighted marks */
  skill_ids: string[] | null;
  /** Normalized weight (0-100) of this item based on its skill weightage */
  skill_weight: number | null;
  /** Skill-weighted marks awarded: (awarded/max) * skill_weight */
  weighted_marks: number | null;
  /** Skill-weighted max marks (= skill_weight when max_marks > 0) */
  weighted_max: number | null;
}

export interface AssociateReviewResult {
  id: string;
  associate_id: string;
  associate_name: string;
  associate_email: string;
  /** When the email was sent to the associate (start date) */
  sent_at: string;
  /** When the associate submitted marks (end date, null if pending) */
  submitted_at: string | null;
  /** 'sent' = pending, 'submitted' = done */
  status: string;
  /** Marks per question */
  marks: QuestionMark[] | null;
  /** Sum of awarded marks */
  total_marks: number | null;
  /** Sum of max marks */
  max_total_marks: number | null;
  /** 'pass' / 'fail' / null */
  result: string | null;
  /** Skill-weighted total awarded marks (0-100 scale) */
  weighted_total: number | null;
  /** Skill-weighted max marks (100 when computable) */
  weighted_max: number | null;
  /** Weighted result converted to a scale of 5: (weighted_total / weighted_max) * 5 */
  weighted_result_out_of_5: number | null;
  review_token?: string;
}

export interface AssociateResultsResponse {
  candidate_stage_id: string;
  candidate_name: string;
  job_name: string;
  department: string;
  position: string;
  github_url: string | null;
  reviews: AssociateReviewResult[];
  /** Total number of associates sent the paper */
  total_associates: number;
  /** Number of associates who have submitted marks */
  submitted_count: number;
}
