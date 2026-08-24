import type { AssociateUpdateFormValues, AssociateCreateFormValues } from "@/schemas/associate";
import type { DesignationRead } from "@/types/designation";

/**
 * Type definitions for Associate read operations.
 * Matches backend AssociateRead.
 */
export interface AssociateRead {
  id: string;
  name: string;
  email: string;
  designation_id: string;
  designation?: DesignationRead | null;
}

export type AssociateCreate = AssociateCreateFormValues;

export type AssociateUpdate = AssociateUpdateFormValues;
