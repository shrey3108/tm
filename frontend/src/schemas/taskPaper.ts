import * as z from "zod";

export const manualQuestionPaperSchema = z.object({
  name: z.string().trim().min(1, "Paper template name is required."),
  questions: z.array(
    z.object({
      value: z.string().trim().min(1, "Question cannot be empty."),
    })
  ).min(1, "At least one question is required."),
  project_tasks: z.array(
    z.object({
      value: z.string().trim(),
    })
  ).optional(),
});

export type ManualQuestionPaperFormValues = z.infer<typeof manualQuestionPaperSchema>;
