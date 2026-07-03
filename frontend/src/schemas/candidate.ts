import * as z from "zod";
import { uuidSchema } from "@/schemas/schema-utils";
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

/**
 * Schema for submitting a project (Technical Practical Round) for a candidate.
 */
export const ProjectSubmissionSchema = z.object({
  /** The repository URL for the project */
  repoUrl: z
    .url("Must be a valid URL") // we can use direct z.url as well but this will also work
    .refine(
      (url) => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes("github.com") || lowerUrl.includes("gitlab.com");
      },
      { message: "URL must be a valid GitHub or GitLab link" }
    ),
  pdfFile: z
    .any()
    .optional()
    .refine((file) => !file || file instanceof File, "Must be a valid file")
    .refine(
      (file) => !file || file.size <= 5 * 1024 * 1024,
      "File size must be less than 5MB"
    )
    .refine(
      (file) => !file || file.type === "application/pdf",
      "Only PDF files are allowed"
    ),
});

export type ProjectSubmissionFormValues = z.infer<typeof ProjectSubmissionSchema>;


export const assignAssociateSchema = z.object({
  associates: z.array(uuidSchema("Invalid associate ID.")).min(1, "Please select at least one associate."),
  workdriveLink: z.url("Please enter a valid Workdrive URL."),
  stageId: uuidSchema("Invalid stage ID. Candidate stage could not be resolved."),
});

export type AssignAssociateFormValues = z.infer<typeof assignAssociateSchema>;