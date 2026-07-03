import type { GuidelineCreateFormValues, GuidelineUpdateFormValues } from "@/schemas/guideline";

/**
 * Represents a Guideline template used to send along with candidate test papers.
 */
export interface Guideline {
  id: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
}

export type GuidelineRead = Guideline;

export type GuidelineCreate = GuidelineCreateFormValues;
export type GuidelineUpdate = GuidelineUpdateFormValues;
