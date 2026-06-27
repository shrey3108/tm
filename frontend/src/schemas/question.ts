import * as z from "zod";




/**
 * Schema for creating or editing a question inside a paper.
 */
export const questionSchema = z.object({
  question: z.string().trim().min(10, "Question must be at least 10 characters long."),
  marks: z.coerce.number({ error: "" }).int().positive({ error: "Marks must be at least 1." }),
  duration: z.coerce.number({ error: "" }).int().min(1, "Duration must be at least 1 minute."),
});

/** Form-specific schema for QuestionModal */
export const questionFormSchema = z.object({
  question: z.string().trim().min(10, "Question must be at least 10 characters long."),
  marks: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? "" : Number(val)),
    z.union([z.number().int().positive({ message: "Marks must be at least 1." }), z.literal("")])
  ),
  hours: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : Number(val)),
    z.number().int().min(0)
  ).optional().default(0),
  minutes: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : Number(val)),
    z.number().int().min(0).max(59)
  ).optional().default(0),
}).refine(data => {
  const h = data.hours || 0;
  const m = data.minutes || 0;
  return h * 60 + m >= 1;
}, {
  message: "Duration must be at least 1 minute.",
  path: ["minutes"],
}).refine(data => data.marks !== "", {
  message: "Marks is required.",
  path: ["marks"],
});

/** Type inferred from questionSchema. */
export type QuestionFormValues = z.infer<typeof questionFormSchema>;

/**
 * Schema for validating an individual project sub-task.
 */
export const subTaskSchema = z.object({
  name: z.string().trim().min(3, "Task must be at least 3 characters long."),
  description: z.string().trim().optional().or(z.literal("")),
  marks: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.union([z.number().int().positive({ message: "Marks must be at least 1." }), z.undefined()])
  ).optional(),
});

/**
 * Schema for creating or editing a project task inside a paper.
 */
export const projectTaskSchema = z.object({
  project_task: z.string().trim().min(10, "Project task must be at least 10 characters long."),
  instructions: z.string().trim().min(10, "Instructions must be at least 10 characters long."),
  hours: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : Number(val)),
    z.number().int().min(0)
  ).optional().default(0),
  minutes: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : Number(val)),
    z.number().int().min(0).max(59)
  ).optional().default(0),
  tasks: z.array(subTaskSchema).min(1, "At least one task is required."),
}).refine(data => {
  const h = data.hours || 0;
  const m = data.minutes || 0;
  return h * 60 + m >= 1;
}, {
  message: "Overall duration must be at least 1 minute.",
  path: ["minutes"],
});

/** Type inferred from projectTaskSchema. */
export type ProjectTaskFormValues = z.infer<typeof projectTaskSchema>;
