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

