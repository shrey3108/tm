import * as z from "zod";
import { nameSchema, uuidSchema } from "@/schemas/schema-utils";
import { DEFAULT_PASSING_THRESHOLD } from "@/constants";


const jobBaseSchema = z.object({
  /** Job title (minimum 3 characters) */
  title: nameSchema(3, "Job title"),
  /** Number of open vacancies */
  vacancy: z.number({
    error: "Vacancy is required",
  }).int({ error: "Enter a valid vacancy number" }).positive({ error: "Enter a valid vacancy number" }).default(1),
  /** UUID of the department this job belongs to */
  department_id: uuidSchema("Please select a valid department"),
  /** Job description text (minimum 20 characters) */
  jd_text: z.string().trim().min(20, "Job description must be at least 20 characters long"),
  /** Whether the job is active */
  is_active: z.boolean(),
  /** Threshold score (0-100) for considering a candidate as 'pass' */
  passing_threshold: z.number().int({ error: "Enter a valid passing threshold" }).positive({ error: "Enter a valid passing threshold" }).max(100, "Enter a valid passing threshold").default(DEFAULT_PASSING_THRESHOLD),
  question_bank_passing_threshold: z.number().int({ error: "Enter a valid passing threshold" }).positive({ error: "Enter a valid passing threshold" }).max(100, "Enter a valid passing threshold").default(DEFAULT_PASSING_THRESHOLD),

  /** Array of skill UUIDs required for this job */
  skill_ids: z.array(uuidSchema("Invalid skill ID")).min(1, "Please select at least one skill"),
  /** Mapping of skill ID to its weightage */
  skill_weightages: z.record(z.string(), z.coerce.number().min(0, "Weightage must be at least 0")).optional().nullable(),
  /** Array of associate UUIDs assigned to this job */
  associate_ids: z.array(uuidSchema("Invalid associate ID")).min(1, "Please select at least one associate"),
  /** Optional custom extraction fields used during resume parsing */
  custom_extraction_fields: z.array(z.string()).optional(),
  /** UUID of the job position */
  position_id: uuidSchema("Please select a valid job position"),
  /** UUID of the job priority */
  priority_id: uuidSchema("Please select a valid Priority"),
  associate_reminder_hours: z.coerce.number().int().positive().min(24, "Reminder hours must be at least 24").multipleOf(24, { error: "Hours must be a multiple of 24 (e.g., 24, 48, 72)" }),
  /** Priority start date */
  priority_start_date: z.string().optional().nullable(),
  /** Priority end date */
  priority_end_date: z.string().optional().nullable(),
  /** Path to the task details file */
  task_file_path: z.string().optional().nullable(),
  /** Extracted or specified task skills */
  task_skills: z.array(z.string()).optional().nullable(),
  /** Toggle to send AI evaluation report to associate */
  send_ai_evaluation_to_associate: z.boolean().default(true),
  /** Optional project requirement documentation PDF file (max size 5MB) */
  // adujest as per backend api
  project_document: z
    .any()
    .optional()
    .refine(
      (file) => !file || file instanceof File || typeof file === "string",
      "Invalid file object"
    )
    .refine(
      (file) => !file || typeof file === "string" || file.size <= 5 * 1024 * 1024,
      "File size must be less than 5MB"
    )
    .refine(
      (file) => !file || typeof file === "string" || file.type === "application/pdf",
      "Only PDF files are allowed"
    ),
});

/**
 * Schema for creating a new job posting.
 */
export const jobCreateSchema = jobBaseSchema.extend({
  is_active: z.boolean().default(true),
  custom_extraction_fields: z.array(z.string().trim()).optional().default([]),
  stages: z.array(z.object({
    template_id: uuidSchema("Invalid template ID"),
    stage_order: z.number().int().min(1),
    is_mandatory: z.boolean().default(true),
    config: z.record(z.string(), z.any()).optional().default({}),
  })).optional().nullable().default(null),
  processing_version: z.number().int().positive().optional(),
});

/** Type inferred from jobCreateSchema. */
export type JobCreateFormValues = z.infer<typeof jobCreateSchema>;

/**
 * Schema for updating an existing job posting.
 */
export const jobUpdateSchema = jobBaseSchema.partial().extend({
  // Vacancy is still required to be a number if provided, but optional in the set
  vacancy: z.number({ error: "Vacancy is required" }).int().min(1, "Vacancy must be at least 1").optional(),
  // skill_ids is still required to have at least 1 if provided
  skill_ids: z.array(uuidSchema("Invalid skill ID")).min(1, "Please select at least one skill").optional(),
  // associate_ids is still required to have at least 1 if provided
  associate_ids: z.array(uuidSchema("Invalid associate ID")).min(1, "Please select at least one associate").optional(),
  position_id: uuidSchema("Please select a valid job position"),
  priority_id: uuidSchema("Please select a valid priority"),
  processing_version: z.number("Please select a valid version").int("Please enter a valid version").positive("Please enter a valid version").optional()
});

/** Type inferred from jobUpdateSchema. */
export type JobUpdateFormValues = z.infer<typeof jobUpdateSchema>;
