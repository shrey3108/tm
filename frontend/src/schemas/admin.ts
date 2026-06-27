
import * as z from "zod";
import { nameSchema, uuidSchema } from "@/schemas/schema-utils";

/**
 * Zod validation schemas for admin entity management.
 * Provides centralized form validation for users, roles, jobs, stages, and criteria.
 */

// --- Job Stage Config Schemas ---

const jobStageConfigBaseSchema = z.object({
  /** UUID of the stage template to use */
  template_id: uuidSchema("Invalid template ID"),
  /** Order of this stage in the interview process */
  stage_order: z.number().int().min(0, "Order must be a non-negative integer"),
  /** Whether passing this stage is required to proceed */
  is_mandatory: z.boolean(),
  /** Stage-specific configuration */
  config: z.record(z.string().trim(), z.any()),
});

/**
 * Schema for adding a stage configuration to a job.
 */
export const jobStageConfigCreateSchema = jobStageConfigBaseSchema.extend({
  is_mandatory: z.boolean().default(true),
  config: z.record(z.string().trim(), z.any()).optional().default({}),
});

/** Type inferred from jobStageConfigCreateSchema. */
export type JobStageConfigCreateFormValues = z.infer<typeof jobStageConfigCreateSchema>;

/**
 * Schema for updating a job stage configuration.
 */
export const jobStageConfigUpdateSchema = jobStageConfigBaseSchema.omit({ template_id: true }).partial();

/** Type inferred from jobStageConfigUpdateSchema. */
export type JobStageConfigUpdateFormValues = z.infer<typeof jobStageConfigUpdateSchema>;

// --- Tech Stack Schemas ---

const techStackBaseSchema = z.object({
  /** Name of the tech stack (minimum 2 characters) */
  name: nameSchema(2, "Tech stack name"),
  /** Optional description of the tech stack */
  description: z.string().trim().optional().nullable(),
});

/**
 * Schema for creating a new tech stack.
 */
export const techStackCreateSchema = techStackBaseSchema;

/** Type inferred from techStackCreateSchema. */
export type TechStackCreateFormValues = z.infer<typeof techStackCreateSchema>;

/**
 * Schema for updating an existing tech stack.
 */
export const techStackUpdateSchema = techStackBaseSchema.partial();

/** Type inferred from techStackUpdateSchema. */
export type TechStackUpdateFormValues = z.infer<typeof techStackUpdateSchema>;




