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

export type MCQFormValues = z.infer<typeof mcqSchema>;