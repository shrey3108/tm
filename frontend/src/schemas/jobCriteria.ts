import * as z from "zod";
import { nameSchema, descriptionSchema } from "@/schemas/schema-utils";

/**
 * Zod validation schema for creating a new job criteria.
 */
export const jobCriteriaCreateSchema = z.object({
  name: nameSchema(3, "Criteria name"),
  description: descriptionSchema(10),
  prompt_text: z.string().trim().optional().or(z.literal("")),
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
 * Matches backend CriterionUpdate.
 */
export const jobCriteriaUpdateSchema = jobCriteriaCreateSchema.partial();

/** Type inferred from jobCriteriaUpdateSchema. */
export type JobCriteriaUpdateFormValues = z.infer<typeof jobCriteriaUpdateSchema>;
