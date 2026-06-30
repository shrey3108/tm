import type { HiringTimelineResponse } from "@/types/candidate";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string to Title Case.
 * Handles underscore and hyphen separators.
 */
export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((word) => capitalize(word.toLowerCase()))
    .join(" ");
}

/**
 * It returns the current stage title for a candidate based on the timeline events.
 * If a stage has pending decisions (both AI and HR), it will be considered as the current stage
 * otherwise it returns the current stage from the response
 */
export function getCorrectCurrentStage(d: HiringTimelineResponse) {
  const firstPendingDecisionStage = d.events.find((e) => (e.hr_decision == null || e.hr_decision == "pending") && e.hr_score == null)
  if (firstPendingDecisionStage?.title == d.current_stage) {
    return d.current_stage
  }
  return firstPendingDecisionStage?.title || d.current_stage
}

export function resolveAssociateViewUrl(review_token: string) {
  return `${import.meta.env.VITE_API_URL}/associate-reviews/${review_token}`
}