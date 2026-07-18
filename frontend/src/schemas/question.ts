import * as z from "zod";

/**
 * Schema for validating the skill selection form.
 */
export const skillFormSchema = z.object({
  skill_ids: z.array(z.string()).min(1, "Please select at least one skill."),
});

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
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().int().min(0).optional()
  ),
  minutes: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().int().min(0).max(59).optional()
  ),
}).refine(data => {
  const hEmpty = data.hours === undefined || data.hours === null;
  const mEmpty = data.minutes === undefined || data.minutes === null;
  return !(hEmpty && mEmpty);
}, {
  message: "Duration is required. Please specify hours or minutes.",
  path: ["minutes"],
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
  description: z.preprocess(
    (val) => (val === null || val === undefined ? "" : val),
    z.string().trim().optional().or(z.literal(""))
  ),
  marks: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? "" : Number(val)),
    z.union([z.number().int().positive({ message: "Marks must be at least 1." }), z.literal("")])
  ).refine(val => val !== "", { message: "Marks is required." }),
});

/**
 * Schema for creating or editing a project task inside a paper.
 */
export const projectTaskSchema = z.object({
  project_task: z.string().trim().min(10, "Project task must be at least 10 characters long."),
  instructions: z.string().trim().min(10, "Instructions must be at least 10 characters long."),
  hours: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().int().min(0).optional()
  ),
  minutes: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().int().min(0).max(59).optional()
  ),
  tasks: z.array(subTaskSchema).min(1, "At least one task is required."),
}).refine(data => {
  const hEmpty = data.hours === undefined || data.hours === null;
  const mEmpty = data.minutes === undefined || data.minutes === null;
  return !(hEmpty && mEmpty);
}, {
  message: "Duration is required. Please specify hours or minutes.",
  path: ["minutes"],
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

export const mcqSchema = z
  .object({
    question: z.string().trim().min(5, "Question must be at least 5 characters long."),
    options: z
      .array(z.string().trim().min(1, "Option cannot be empty."))
      .min(2, "At least two options are required."),
    answer: z.string().min(1, "Correct answer is required."),
    marks: z.coerce.number({ error: "" }).int().positive({ error: "Marks must be at least 1." }),
    duration: z.coerce.number({ error: "" }).int().min(1, "Duration must be at least 1 minute."),
  })
  .refine(
    (data) => {
      const index = data.answer.charCodeAt(0) - 65;
      return index >= 0 && index < data.options.length;
    },
    {
      message: "The correct answer must be one of the options.",
      path: ["answer"],
    }
  );

export const mcqFormSchema = z
  .object({
    question: z.string().trim().min(5, "Question must be at least 5 characters long."),
    options: z
      .array(z.string().trim().min(1, "Option cannot be empty."))
      .min(2, "At least two options are required."),
    answer: z.string().min(1, "Correct answer is required."),
    marks: z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? "" : Number(val)),
      z.union([z.number().int().positive({ message: "Marks must be at least 1." }), z.literal("")])
    ),
    hours: z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
      z.number().int().min(0).optional()
    ),
    minutes: z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
      z.number().int().min(0).max(59).optional()
    ),
  })
  .refine(
    (data) => {
      const index = data.answer.charCodeAt(0) - 65;
      return index >= 0 && index < data.options.length;
    },
    {
      message: "The correct answer must be one of the options.",
      path: ["answer"],
    }
  )
  .refine(data => {
    const hEmpty = data.hours === undefined || data.hours === null;
    const mEmpty = data.minutes === undefined || data.minutes === null;
    return !(hEmpty && mEmpty);
  }, {
    message: "Duration is required. Please specify hours or minutes.",
    path: ["minutes"],
  })
  .refine(data => {
    const h = data.hours || 0;
    const m = data.minutes || 0;
    return h * 60 + m >= 1;
  }, {
    message: "Duration must be at least 1 minute.",
    path: ["minutes"],
  })
  .refine(data => data.marks !== "", {
    message: "Marks is required.",
    path: ["marks"],
  });

export type MCQFormValues = z.infer<typeof mcqFormSchema>;

