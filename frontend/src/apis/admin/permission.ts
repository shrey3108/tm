import apiClient from "@/apis/client";
import type { PermissionCreate, PermissionRead } from "@/types/permission-role";
import type { PaginatedResponse, } from "@/types/admin";

const ADMIN_PATH = import.meta.env.VITE_ADMIN_API_ENDPOINT || "/admin";

/**
 * Permission Management APIs
 */
export const adminPermissionService = {
  /**
   * Get all permissions (admin only).
   */
  getAllPermissions: async (skip: number = 0, limit: number = 100): Promise<PaginatedResponse<PermissionRead>> => {
    const response = await apiClient.get<PaginatedResponse<PermissionRead>>(`${ADMIN_PATH}/permissions`, {
      params: { skip, limit },
    });
    return response.data;
  },

  /**
   * Create a new permission (admin only).
   */
  createPermission: async (permission: PermissionCreate): Promise<PermissionRead> => {
    const response = await apiClient.post<PermissionRead>(`${ADMIN_PATH}/permissions`, permission);
    return response.data;
  },

  /**
   * Delete a permission (admin only).
   */
  deletePermission: async (permissionId: string): Promise<void> => {
    await apiClient.delete(`${ADMIN_PATH}/permissions/${permissionId}`);
  },
};
