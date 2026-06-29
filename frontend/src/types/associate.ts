import type { AssociateUpdateFormValues, AssociateCreateFormValues } from "@/schemas/associate";
/**
 * Type definitions for Associate read operations.
 * Matches backend AssociateRead.
 */
export interface AssociateRead {
  id: string;
  name: string;
  email: string;
}

export type AssociateCreate = AssociateCreateFormValues;

export type AssociateUpdate = AssociateUpdateFormValues;
