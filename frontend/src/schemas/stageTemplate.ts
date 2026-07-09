import * as z from "zod";
import { nameSchema, descriptionSchema } from "@/schemas/schema-utils";

const stageTemplateBaseSchema = z.object({
  /** Name of the stage template (minimum 3 characters) */
  name: nameSchema(3, "Template name"),
  /** Optional description of the stage */
  description: descriptionSchema(10),
  /** Default configuration object for the stage */
  default_config: z.object({
    is_active: z.boolean().default(true),
    required_inputs: z.array(z.enum(["resume", "transcript", "question", "github"])).min(1, "At least one stage requirement is required"),
    criteria_ids: z.array(z.string()).min(1, "At least one evaluation criterion must be selected"),
  }),
  /** Whether this stage is automatically assigned to new jobs */
  is_default: z.boolean().default(false),
  /** The default position of this stage in a new pipeline */
  default_order: z.coerce.number({ error: "Order is required" }).int().min(0, "Order must be a non-negative integer"),
});

/**
 * Schema for creating a new stage template.
 */
export const stageTemplateCreateSchema = stageTemplateBaseSchema;

/** Type inferred from stageTemplateCreateSchema. */
export type StageTemplateCreateFormValues = z.infer<typeof stageTemplateCreateSchema>;

/**
 * Schema for updating an existing stage template.
 */
export const stageTemplateUpdateSchema = stageTemplateBaseSchema.partial();

/** Type inferred from stageTemplateUpdateSchema. */
export type StageTemplateUpdateFormValues = z.infer<typeof stageTemplateUpdateSchema>;
