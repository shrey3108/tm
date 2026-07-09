import type { JobCriteriaCreateFormValues, JobCriteriaUpdateFormValues } from "@/schemas/jobCriteria";

/**
 * Shared fields for an evaluation criterion.
 */
export interface CriterionBase {
  name: string;
  description?: string | null;
  prompt_text?: string | null;
}

/**
 * Payload for creating a new evaluation criterion.
 */
export type CriterionCreate = JobCriteriaCreateFormValues;

/**
 * Payload for updating an existing evaluation criterion.
 */
export type CriterionUpdate = JobCriteriaUpdateFormValues;

/**
 * Evaluation criterion returned from read operations.
 */
export interface CriterionRead extends CriterionBase {
  id: string;
  created_at: string;
}
