import type { SkillCreateFormValues, SkillUpdateFormValues } from "@/schemas/skill";

/**
 * Base fields for a skill.
 */
export interface SkillBase {
  id: string;
  name: string;
  description?: string;
  default_weightage?: number;
}

/**
 * Payload for creating a new skill.
 */
export type SkillCreate = SkillCreateFormValues

/**
 * Payload for updating an existing skill.
 */
export type SkillUpdate = SkillUpdateFormValues

/**
 * Skill returned from read operations.
 */
export type SkillRead = SkillBase
