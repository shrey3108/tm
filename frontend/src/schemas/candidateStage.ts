import { z } from "zod";
import { uuidSchema } from "@/schemas/schema-utils";

/**
 * Zod schema for stage override payload .
 * Matches backend StageOverrideCreate.
 */
export const stageOverrideCreateSchema = z.object({
  override_reason: z.string().trim().min(1, "Override reason is required"),
  override_recommendation: z.enum(["pass", "fail", "May Be"]).nullable().optional(),
  criterion_scores: z.record(z.string(), z.number()).nullable().optional(),
});

/**
 * Zod schema for stage decision payload .
 * Matches backend StageDecisionCreate.
 */
export const stageDecisionCreateSchema = z.object({
  decision: z.enum(["pass", "fail", "May Be"]),
  notes: z.string().trim().nullable().optional(),
});

/**
 * Zod schema for sending test paper + GitHub URL to multiple associates.
 * Matches backend SendToAssociatesRequest.
 */
export const sendToAssociatesRequestSchema = z.object({
  associate_ids: z.array(uuidSchema("Invalid associate ID")).min(1, "At least one associate ID must be selected"),
  workdrive_url: z.string().trim().url("Invalid workdrive URL").or(z.literal("")).nullable().optional(),
});

export type StageOverrideCreate = z.infer<typeof stageOverrideCreateSchema>;
export type StageDecisionCreate = z.infer<typeof stageDecisionCreateSchema>;
export type SendToAssociatesRequest = z.infer<typeof sendToAssociatesRequestSchema>;

/**
 * Zod schema for triggering background GitHub evaluation.
 * Matches backend GitHubEvaluationRequest.
 */
export const gitHubEvaluationRequestSchema = z.object({
  github_url: z.string().trim().url("Invalid GitHub URL").min(1, "GitHub URL is required"),
});

export type GitHubEvaluationRequest = z.infer<typeof gitHubEvaluationRequestSchema>;
