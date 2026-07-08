/**
 * Type definitions for interview stages.
 */

/**
 * Common interview stage status.
 */
export type StageStatus = "pending" | "processing" | "completed" | "failed";

export type StagesRequiredInputs = "transcript" | "resume" | "question" | "github";

/**
 * evaluation criteria for a stage
 */
export interface EvaluationCriteria {
  /** Unique identifier for the evaluation criteria */
  id: string,
  /**  Name of the evaluation criteria */
  name: string
}



export interface EvaluationCriterionConfig {
  id?: string | null;
  name: string;
}

export interface DefaultConfig {
  /**
   * Type of the evaluation, it can be "audio" or "video" etc but for now it witll be string
   */
  type?: string;
  /**
   * evaluation criteria for the stage
   */
  evaluation_criteria: (EvaluationCriterionConfig | string)[];
  required_inputs?: StagesRequiredInputs[];
  is_panel_interview?: boolean | null;
  [key: string]: any;
}

/**
 * Interview stage template definition.
 * Represents a reusable stage type that can be configured per job.
 */
export interface StageTemplate {
  /** Unique identifier for the stage template */
  id: string;
  /** Name of the stage type (e.g., "HR Screening", "Technical Interview") */
  name: string;
  /** Optional description of the stage */
  description: string | null;
  /** Default configuration for this stage type */
  config: DefaultConfig;
  /** Whether this stage is part of the default pipeline */
  is_default?: boolean;
  /** Optional order for the default pipeline */
  default_order?: number | null;
}

/**
 * Job-specific stage configuration.
 * Associates a stage template with a job and defines order and requirements.
 */
export interface JobStageConfig {
  /** Unique identifier for this stage configuration */
  id: string;
  /** ID of the job this stage belongs to */
  job_id: string;
  /** ID of the stage template used */
  template_id: string;
  /** Order of this stage in the interview process (0-indexed) */
  stage_order: number;
  /** Job-specific configuration overrides */
  config: DefaultConfig;
  /** Whether passing this stage is required to proceed */
  is_mandatory: boolean;
  /** The stage template details */
  template: StageTemplate;
}

/**
 * Evaluation record for a candidate at a specific interview stage.
 */
export interface StageEvaluation {
  /** Unique identifier for this evaluation */
  id: string;
  /** ID of the candidate being evaluated */
  candidate_id: string;
  /** ID of the job stage configuration */
  job_stage_config_id: string;
  /** Current status of the evaluation */
  status: StageStatus;
  /** Dynamic payload based on stage type */
  analysis: any | null;
  /** Pass/fail decision from the evaluation */
  decision: boolean | null;
  /** Timestamp when the evaluation was created */
  created_at?: string;
  /** Timestamp when the evaluation was completed */
  completed_at?: string | null;
}

/**
 * Minimal summary of a stage for embedding in candidate responses.
 */
export interface CandidateStageSummary {
  stage_id: string;
  template_name: string;
  status: StageStatus | string;
  order: number;
  required_inputs: StagesRequiredInputs[];
  job_id?: string | null;
  job_name?: string | null;
  completed_at?: string | null;
  job_stage_id?: string | null;
  hr_decision?: string | null;
  ai_result?: string | null
  completed: boolean;

  evaluation_data: any
}
