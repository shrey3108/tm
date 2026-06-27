import * as z from "zod";
import { nameSchema ,emailSchema, uuidSchema} from "@/schemas/schema-utils";


/**
 * Base fields for user management.
 */
const userBaseSchema = z.object({
  /** User's full name */
  full_name: nameSchema(2, "Full name"),
  /** Whether the user account is active */
  is_active: z.boolean(),
  /** UUID of the role to assign */
  role_id: uuidSchema("Invalid role ID"),
});

/**
 * Schema for creating a new user via admin panel.
 * Validates email format, password requirements, and role assignment.
 */
export const userCreateSchema = userBaseSchema.extend({
  /** Valid email address */
  email: emailSchema,
  /** Password with minimum 8 characters, optional for admin creation */
  password: z
    .string().trim()
    .min(8, "Password must be at least 8 characters long")
    .optional()
    .or(z.literal("")),
}).partial({
  full_name: true,
}).extend({
  is_active: z.boolean().default(true),
});

/** Type inferred from userCreateSchema. */
export type UserCreateFormValues = z.infer<typeof userCreateSchema>;

/**
 * Schema for updating an existing user via admin panel.
 * All fields are optional to allow partial updates.
 */
export const userUpdateSchema = userBaseSchema.partial();

/** Type inferred from userUpdateSchema. */
export type UserUpdateFormValues = z.infer<typeof userUpdateSchema>;
