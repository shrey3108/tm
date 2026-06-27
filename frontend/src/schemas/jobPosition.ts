import * as z from "zod";
import { nameSchema } from "@/schemas/schema-utils";



const jobPositionBaseSchema = z.object({
  /** Name of the position (minimum 2 characters) */
  name: nameSchema(2, "Position name"),
});

/**
 * Schema for creating a new job position.
 */
export const jobPositionCreateSchema = jobPositionBaseSchema;

/** Type inferred from jobPositionCreateSchema. */
export type JobPositionCreateFormValues = z.infer<typeof jobPositionCreateSchema>;

/**
 * Schema for updating an existing job position.
 */
export const jobPositionUpdateSchema = jobPositionBaseSchema.partial();

/** Type inferred from jobPositionUpdateSchema. */
export type JobPositionUpdateFormValues = z.infer<typeof jobPositionUpdateSchema>;
