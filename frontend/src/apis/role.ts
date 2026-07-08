import apiClient from "@/apis/client";
import type { RoleCreate, RoleRead, RoleUpdate, RoleWithPermissions } from "@/types/permission-role";
import type { PaginatedResponse, } from "@/types/admin";

const ADMIN_PATH = import.meta.env.VITE_ADMIN_API_ENDPOINT || "/admin";

/**
 * Role Management APIs
 */
export const adminRoleService = {
  /**
   * Get all roles (admin only).
   */
  getAllRoles: async ({
    skip = 0,
    limit = 100,
    q,
  }: {
    skip?: number;
    limit?: number;
    q?: string;
  } = {}): Promise<PaginatedResponse<RoleRead>> => {
    const response = await apiClient.get<PaginatedResponse<RoleRead>>(`${ADMIN_PATH}/roles`, {
      params: { skip, limit, q: q === "" ? undefined : q },
    });
    return response.data;
  },

  /**
   * Create a new role (admin only).
   */
  createRole: async (role: RoleCreate): Promise<RoleWithPermissions> => {
    const response = await apiClient.post<RoleWithPermissions>(`${ADMIN_PATH}/roles`, role);
    return response.data;
  },

  /**
   * Get a specific role by ID (admin only).
   */
  getRoleById: async (roleId: string): Promise<RoleWithPermissions> => {
    const response = await apiClient.get<RoleWithPermissions>(`${ADMIN_PATH}/roles/${roleId}`);
    return response.data;
  },

  /**
   * Update a role (admin only).
   */
  updateRole: async ({
    id,
    data,
  }: {
    id: string;
    data: RoleUpdate;
  }): Promise<RoleWithPermissions> => {
    const response = await apiClient.patch<RoleWithPermissions>(
      `${ADMIN_PATH}/roles/${id}`,
      data,
    );
    return response.data;
  },

  /**
   * Delete a role (admin only).
   */
  deleteRole: async (roleId: string): Promise<void> => {
    await apiClient.delete(`${ADMIN_PATH}/roles/${roleId}`);
  },
};
