import * as z from "zod";
import { nameSchema } from "@/schemas/schema-utils";

/**
 * Zod validation schema for creating a new Designation.
 * Matches backend DesignationCreate.
 */
export const designationCreateSchema = z.object({
  name: nameSchema(2, "Designation name"),
});

/**
 * Zod validation schema for updating a Designation.
 * Matches backend DesignationUpdate.
 */
export const designationUpdateSchema = z.object({
  name: nameSchema(2, "Designation name").optional(),
});

export type DesignationCreateFormValues = z.infer<typeof designationCreateSchema>;
export type DesignationUpdateFormValues = z.infer<typeof designationUpdateSchema>;
