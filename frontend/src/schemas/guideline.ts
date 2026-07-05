import * as z from "zod";

/**
 * Zod validation schema for creating a new Guideline.
 * Matches backend GuidelineCreate.
 */
export const guidelineCreateSchema = z.object({
  content: z.string().trim().min(10, "Guideline content atleast 10 characters"),
  is_default: z.boolean().default(false),
});

/**
 * Zod validation schema for updating an existing Guideline.
 * Matches backend GuidelineUpdate.
 */
export const guidelineUpdateSchema = z.object({
  content: z.string().trim().min(10, "Guideline content atleast 10 characters"),
  is_default: z.boolean().optional(),
});

export type GuidelineCreateFormValues = z.infer<typeof guidelineCreateSchema>;
export type GuidelineUpdateFormValues = z.infer<typeof guidelineUpdateSchema>;
