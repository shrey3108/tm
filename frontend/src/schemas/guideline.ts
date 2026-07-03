import * as z from "zod";

/**
 * Zod validation schema for creating a new Guideline.
 * Matches backend GuidelineCreate.
 */
export const guidelineCreateSchema = z.object({
  content: z.string().trim().min(1, "Guideline content cannot be empty"),
});

/**
 * Zod validation schema for updating an existing Guideline.
 * Matches backend GuidelineUpdate.
 */
export const guidelineUpdateSchema = z.object({
  content: z.string().trim().min(1, "Guideline content cannot be empty").optional(),
});

export type GuidelineCreateFormValues = z.infer<typeof guidelineCreateSchema>;
export type GuidelineUpdateFormValues = z.infer<typeof guidelineUpdateSchema>;
