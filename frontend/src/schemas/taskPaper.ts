import * as z from "zod";

export const manualQuestionPaperSchema = z.object({
  questions: z.array(
    z.object({
      value: z.string().trim().min(1, "Question cannot be empty."),
    })
  ).min(1, "At least one question is required."),
  project_tasks: z.array(
    z.object({
      value: z.string().trim().min(10, "Project task description must be at least 10 characters."),
      instructions: z.string().trim().min(10, "Instructions must be at least 10 characters."),
    })
  ).optional(),
});

export type ManualQuestionPaperFormValues = z.infer<typeof manualQuestionPaperSchema>;

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
      (val) => (val === "" || val === undefined || val === null ? 0 : Number(val)),
      z.number().int().min(0)
    ).optional().default(0),
    minutes: z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? 0 : Number(val)),
      z.number().int().min(0).max(59)
    ).optional().default(0),
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