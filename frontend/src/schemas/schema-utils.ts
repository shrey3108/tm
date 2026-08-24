import * as z from "zod";

export const nameSchema = (min: number, entity: string) =>
    z.string().trim().min(min, `${entity} must be at least ${min} characters long`);

/** Factory for optional descriptions with minimum character requirement */
export const descriptionSchema = (min: number = 5) =>
    z.string().trim().min(min, `Description must be at least ${min} characters long`);

/** Standard UUID validation with custom error message */
export const uuidSchema = (message: string = "Invalid UUID") => z.string().uuid(message);

/** Base email validation schema */
export const emailSchema = z.email("Invalid email address").trim();
