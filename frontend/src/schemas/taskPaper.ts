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
    optionA: z.string().trim().min(1, "Option A cannot be empty."),
    optionB: z.string().trim().min(1, "Option B cannot be empty."),
    optionC: z.string().trim(),
    optionD: z.string().trim(),
    answer: z.enum(["A", "B", "C", "D"], {
      message: "Invalid selection. Choose A, B, C, or D.",
    }),
  })
  .refine(
    (data) => {
      if (data.optionD && !data.optionC) {
        return false;
      }
      return true;
    },
    {
      message: "Option C must be filled before Option D.",
      path: ["optionC"],
    }
  )
  .refine(
    (data) => {
      if (data.answer === "C" && !data.optionC) {
        return false;
      }
      if (data.answer === "D" && !data.optionD) {
        return false;
      }
      return true;
    },
    {
      message: "The correct answer must be one of the filled options.",
      path: ["answer"],
    }
  );

export type MCQFormValues = z.infer<typeof mcqSchema>;