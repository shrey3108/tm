import type { DepartmentCreateFormValues, DepartmentUpdateFormValues } from "@/schemas/department";

/**
 * Shared fields for a department.
 */
export interface DepartmentBase {
  id: string;
  name: string;
  description?: string;
}

/**
 * Payload for creating a new department.
 */
export type DepartmentCreate = DepartmentCreateFormValues

/**
 * Payload for updating an existing department.
 */
export type DepartmentUpdate = DepartmentUpdateFormValues

/**
 * Department returned from read operations.
 */
export type DepartmentRead = DepartmentBase
