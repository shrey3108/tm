import * as z from "zod";
import { nameSchema, emailSchema } from "@/schemas/schema-utils";

/**
 * Zod validation schema for creating a new Associate.
 * Matches backend AssociateCreate.
 */
export const associateCreateSchema = z.object({
  name: nameSchema(2, "Associate name"),
  email: emailSchema,
});

/**
 * Zod validation schema for updating an existing Associate.
 * Matches backend AssociateUpdate.
 */
export const associateUpdateSchema = z.object({
  name: nameSchema(2, "Associate name").optional(),
  email: emailSchema.optional(),
});

export type AssociateCreateFormValues = z.infer<typeof associateCreateSchema>;
export type AssociateUpdateFormValues = z.infer<typeof associateUpdateSchema>;
