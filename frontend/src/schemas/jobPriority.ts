import * as z from "zod";


const jobPriorityBaseSchema = z.object({
  /** Name of the priority (minimum 2 characters) */
  // name: nameSchema(2, "Priority name"),
  /** Duration in days (minimum 1 day) */
  duration_days: z.number({
    error: "Duration is required",
  }).int().positive().min(1, "Duration must be at least 1 day"),

  associate_reminder_hours: z.number().int().positive().min(24, "Reminder hours must be at least 24").multipleOf(24, { error: "Hours must be a multiple of 24 (e.g., 24, 48, 72)" }),
});

/**
 * Schema for creating a new job priority.
 */
export const jobPriorityCreateSchema = jobPriorityBaseSchema;

/** Type inferred from jobPriorityCreateSchema. */
export type JobPriorityCreateFormValues = z.infer<typeof jobPriorityCreateSchema>;

/**
 * Schema for updating an existing job priority.
 */
export const jobPriorityUpdateSchema = jobPriorityBaseSchema.partial();

/** Type inferred from jobPriorityUpdateSchema. */
export type JobPriorityUpdateFormValues = z.infer<typeof jobPriorityUpdateSchema>;
