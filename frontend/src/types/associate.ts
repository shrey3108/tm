import type { AssociateUpdateCreateFormValues, AssociateCreateCreateFormValues } from "@/schemas/associate";
/**
 * Type definitions for Associate read operations.
 * Matches backend AssociateRead.
 */
export interface AssociateRead {
  id: string;
  name: string;
  email: string;
}

export type AssociateCreate =AssociateCreateCreateFormValues;

export type AssociateUpdate = AssociateUpdateCreateFormValues;
