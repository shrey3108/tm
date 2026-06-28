import * as z from "zod";
import { uuidSchema } from "@/schemas/schema-utils";

/**
 * Schema for adding a single stage to a job.
 * Matches backend JobStageConfigCreate.
 */
export const jobStageConfigCreateSchema = z.object({
  template_id: uuidSchema("Invalid template ID"),
  stage_order: z.number().int().min(1),
  config: z.record(z.any(), z.any()).nullable().optional(),
  is_mandatory: z.boolean().default(true),
});

/**
 * Schema for updating a job-specific stage configuration.
 * Matches backend JobStageConfigUpdate.
 */
export const jobStageConfigUpdateSchema = z.object({
  stage_order: z.number().int().min(1).optional(),
  config: z.record(z.any(), z.any()).nullable().optional(),
  is_mandatory: z.boolean().optional(),
});

/**
 * Schema for bulk adding stages to a job.
 * Matches backend JobStageBulkCreate.
 */
export const jobStageBulkCreateSchema = z.object({
  stages: z.array(jobStageConfigCreateSchema).min(1),
});

/**
 * Schema for reordering stages within a job.
 * Matches backend JobStageReorder.
 */
export const jobStageReorderSchema = z.object({
  stage_ids: z.array(z.uuid()),
});

/**
 * Zod schema for updating a job stage's criteria config (from /job-stages/{id}/config).
 * Matches backend StageConfigUpdate.
 */
export const stageConfigUpdateSchema = z.object({
  active_criteria_ids: z.array(z.uuid()),
  system_prompt_override: z.string().trim().nullable().optional(),
});

// Derived types for user input
export type JobStageConfigCreate = z.infer<typeof jobStageConfigCreateSchema>;
export type JobStageConfigUpdate = z.infer<typeof jobStageConfigUpdateSchema>;
export type JobStageBulkCreate = z.infer<typeof jobStageBulkCreateSchema>;
export type JobStageReorder = z.infer<typeof jobStageReorderSchema>;
export type StageConfigUpdate = z.infer<typeof stageConfigUpdateSchema>;
