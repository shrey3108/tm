import type { JobPriorityCreateFormValues, JobPriorityUpdateFormValues } from "@/schemas/jobPriority";
/**
 * Job priority returned from read operations.
 */
export interface JobPriorityRead {
  id: string;
  name: string;
  duration_days: number;
  created_at: string;
  updated_at: string;
  assigned_jobs_count: number
  associate_reminder_hours: number
}

/**
 * Payload for creating a new job priority.
 */
export type JobPriorityCreate = JobPriorityCreateFormValues

/**
 * Payload for updating an existing job priority.
 */
export type JobPriorityUpdate = JobPriorityUpdateFormValues
