import type { JobPositionCreateFormValues,JobPositionUpdateFormValues} from "@/schemas/jobPosition";
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
export type JobPositionCreate= JobPositionCreateFormValues

/**
 * Payload for updating an existing job position.
 */
export type JobPositionUpdate =JobPositionUpdateFormValues
