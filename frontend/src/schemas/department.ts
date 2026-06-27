import * as z from "zod";
import { nameSchema } from "@/schemas/schema-utils";


const departmentBaseSchema = z.object({
  /** Name of the department (minimum 2 characters) */
  name: nameSchema(2, "Department name"),
  /** Optional description of the department */
  description: z.string().trim().optional().nullable(),
});

/**
 * Schema for creating a new department.
 */
export const departmentCreateSchema = departmentBaseSchema;

/** Type inferred from departmentCreateSchema. */
export type DepartmentCreateFormValues = z.infer<typeof departmentCreateSchema>;

/**
 * Schema for updating an existing department.
 */
export const departmentUpdateSchema = departmentBaseSchema.partial();

/** Type inferred from departmentUpdateSchema. */
export type DepartmentUpdateFormValues = z.infer<typeof departmentUpdateSchema>;
