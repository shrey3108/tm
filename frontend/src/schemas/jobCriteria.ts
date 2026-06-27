import * as z from "zod";
import { nameSchema,descriptionSchema } from "@/schemas/schema-utils";


const jobCriteriaBaseSchema = z.object({
  /** Name of the criteria (minimum 3 characters) */
  name: nameSchema(3, "Criteria name"),
  /** Description of the criteria (minimum 5 characters) */
  description: descriptionSchema(),
  /** Whether the criteria is active */
  is_active: z.boolean(),
  /** Whether to apply this criteria to all jobs */
  apply_to_all: z.boolean(),
  /** List of job UUIDs this criteria applies to (if not apply_to_all) */
  job_ids: z.array(z.string()).optional(),
});

/**
 * Schema for creating a new job criteria.
 */
export const jobCriteriaCreateSchema = jobCriteriaBaseSchema.extend({
  is_active: z.boolean().default(true),
  apply_to_all: z.boolean().default(true),
  job_ids: z.array(z.string()).optional().default([]),
  prompt_text: descriptionSchema(),
});

/**
 * Schema for enhancing job criteria.
 */
export const enhanceJobCriteriaSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters long"),
  description: z.string().trim().min(10, "Description must be at least 10 characters long"),
});

/** Type inferred from jobCriteriaCreateSchema. */
export type JobCriteriaCreateFormValues = z.infer<typeof jobCriteriaCreateSchema>;

/**
 * Schema for updating an existing job criteria.
 */
export const jobCriteriaUpdateSchema = jobCriteriaBaseSchema.partial();

/** Type inferred from jobCriteriaUpdateSchema. */
export type JobCriteriaUpdateFormValues = z.infer<typeof jobCriteriaUpdateSchema>;
