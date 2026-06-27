import * as z from "zod";
import { nameSchema, uuidSchema,descriptionSchema } from "@/schemas/schema-utils";

/**
 * Schema for creating a new permission.
 * Requires permission name and description.
 */
export const permissionCreateSchema = z.object({
  /** Name of the permission (minimum 3 characters) */
  name: nameSchema(3, "Permission name"),
  /** Description of what the permission allows (minimum 5 characters) */
  description: descriptionSchema(),
});

/** Type inferred from permissionCreateSchema. */
export type PermissionCreateFormValues = z.infer<typeof permissionCreateSchema>;



/**
 * Schema for creating a new role with optional permissions.
 */
export const roleCreateSchema = z.object({
  /** Name of the role (minimum 3 characters) */
  name: nameSchema(3, "Role name"),
  /** Array of permission UUIDs to assign to the role */
  permission_ids: z.array(uuidSchema("Invalid permission ID")).optional().default([]),
});

/** Type inferred from roleCreateSchema. */
export type RoleCreateFormValues = z.infer<typeof roleCreateSchema>;
