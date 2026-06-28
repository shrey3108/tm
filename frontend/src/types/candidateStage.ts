/**
 * Type definitions for candidate stage evaluations and decisions.
 */

/**
 * A categorized item is an object with a single key (category name) mapping to a value.
 * Used for structured highlights grouped by sub-headings like "JD Alignment", "Architecture", etc.
 */
export type CategorizedStringItem = Record<string, string>;
export type CategorizedStringArrayItem = Record<string, string[]>;

/**
 * Interface for the highlights of a candidate stage evaluation.
 * Supports both simple format (string/string[]) and categorized format (array of {category: value} objects).
 */
export interface Highlight {
  overall_summary: string | CategorizedStringItem[];
  recommendation: string;
  strengths: string[] | CategorizedStringArrayItem[];
  weaknesses: string[] | CategorizedStringArrayItem[];
  suggested_followups: string[] | CategorizedStringArrayItem[];
  [key: string]: any;
}

/**
 * Full evaluation result for a candidate stage.
 * Matches backend EvaluationRead.
 */
export interface EvaluationRead {
  id: string;
  interview_id?: string | null;
  transcript_id?: string | null;
  version?: number;
  result?: string;
  status?: string;
  error_message?: string | null;
  candidate_stage_id: string;
  evaluation_data: Record<string, any> | Record<string, Array<Record<string, Criteria>>>;
  overall_score?: number | null;
  recommendation?: string | null;
  sim_jd_resume?: number | null;
  sim_jd_transcript?: number | null;
  sim_resume_transcript?: number | null;
  evidence_block?: Record<string, any> | null;
  created_at: string;
  highlights: Highlight;
  jd_skills?: string[] | null;
  project_required_skills?: string[] | null;
}

/**
 * Similarity metrics response.
 */
export interface SimilarityScores {
  candidate_stage_id: string;
  similarity_scores: {
    jd_vs_resume: number | null;
    jd_vs_transcript: number | null;
    resume_vs_transcript: number | null;
  };
}

/**
 * Response from a stage decision.
 */
export interface StageDecisionResponse {
  message: string;
  candidate_status: string;
}

export interface EvaluationHistoryRead {
  id: string
  interview_id: string
  transcript_id: string
  candidate_stage_id: string
  version: number
  overall_score: number
  result: string
  evaluation_data: EvaluationData
  sim_jd_resume: number
  sim_jd_transcript: number
  sim_resume_transcript: number
  created_at: string
  highlights: Highlights
}

export interface EvaluationData {
  criteria: Record<string, Criteria>
}

export interface Criteria {
  score: number
  evidence: string[]
  reasoning: string
  confidence: number
}

export interface Highlights {
  strengths: string[] | CategorizedStringArrayItem[]
  weaknesses: string[] | CategorizedStringArrayItem[]
  suggested_followups: string[] | CategorizedStringArrayItem[]
  overall_summary: string | CategorizedStringItem[]
  recommendation: string
  [key: string]: any;
}

export interface AssociateEmailResult {
  associate_id: string;
  name: string;
  email: string;
  status: string; // "sent" or "failed"
  error?: string | null;
}

export interface SendToAssociatesResponse {
  status: string;
  message: string;
  candidate_stage_id: string;
  candidate_name: string;
  github_url: string;
  paper_id?: string | null;
  paper_name?: string | null;
  sent_to: AssociateEmailResult[];
  failed: AssociateEmailResult[];
}
