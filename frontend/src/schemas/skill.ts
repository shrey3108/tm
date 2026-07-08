import * as z from "zod";
import { nameSchema } from "@/schemas/schema-utils";


const skillBaseSchema = z.object({
    /** Name of the skill (minimum 2 characters) */
    name: nameSchema(2, "Skill name"),
    /** Optional description of the skill */
    description: z.string().trim().optional(),
    /** Default weightage for this skill */
    default_weightage: z.number().min(0, "Weightage must be at least 0").optional().default(10),
});

/**
 * Schema for creating a new skill.
 */
export const skillCreateSchema = skillBaseSchema;

/** Type inferred from skillCreateSchema. */
export type SkillCreateFormValues = z.infer<typeof skillCreateSchema>;

/**
 * Schema for updating an existing skill.
 */
export const skillUpdateSchema = skillBaseSchema.partial();

/** Type inferred from skillUpdateSchema. */
export type SkillUpdateFormValues = z.infer<typeof skillUpdateSchema>;