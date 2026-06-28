// import { } from "@/schemas/"

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
