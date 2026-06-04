/**
 * Type definitions for candidate stage evaluations and decisions.
 */

/**
 * Interface for the highlights of an candidate stage evaluation
 */
export interface Highlight {
  overall_summary: string;
  recommendation: string;
  strengths: string[];
  weaknesses: string[];
  suggested_followups: string[];
}

/**
 * Full evaluation result for a candidate stage.
 * Matches backend EvaluationRead.
 */
export interface EvaluationRead {
  id: string;
  interview_id?: string | null;
  transcript_id?: string | null;
  candidate_stage_id: string;
  evaluation_data: Record<string, any> | Record<string, Array<Record<string, Criteria>>>;
  overall_score?: number | null;
  recommendation?: string | null;
  sim_jd_resume?: number | null;
  sim_jd_transcript?: number | null;
  sim_resume_transcript?: number | null;
  evidence_block?: Record<string, any> | null;
  created_at: string;
  highlights: Highlight
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
  strengths: string[]
  weaknesses: string[]
  suggested_followups: string[]
  overall_summary: string
  recommendation: string
}
