/**
 * Type definitions for Designation read, create, and update operations.
 * Matches backend DesignationRead, DesignationCreate, and DesignationUpdate schemas.
 */

import type { DesignationUpdateFormValues, DesignationCreateFormValues } from "@/schemas/designation";

export interface DesignationRead {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}


export type DesignationCreate = DesignationCreateFormValues;

export type DesignationUpdate = DesignationUpdateFormValues;