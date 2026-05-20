import * as z from "zod";

/**
 * Zod validation schema for candidate screening decisions.
 */

/**
 * Schema for submitting a screening decision (approve/reject/maybe) for a candidate.
 * Validates the decision type and ensures a reason is provided.
 */
export const candidateDecisionSchema = z.object({
  /** The screening decision */
  decision: z.enum(["pass", "fail", "maybe"]),
  /** The reason/note for the decision (minimum 10 characters for better justification) */
  note: z
    .string()
    .min(10, "Reason must be at least 10 characters long")
    .max(1000, "Reason must not exceed 1000 characters"),

  /** Score out of 5 (1 to 5). Required when decision is 'pass' or 'fail'. */
  score: z.number({ error: "score is required" })
    .positive({ message: "score should be greater than 0" })
    .min(1, { message: "score should be greater than 0" })
    .max(5, { message: "score should be at most 5" })
});

/**
 * Type inferred from candidateDecisionSchema.
 */
export type CandidateDecisionFormValues = z.infer<typeof candidateDecisionSchema>;
