import apiClient from "@/apis/client";
import type { UserAdminCreate, UserAdminRead, UserAdminUpdate } from "@/types/permission-role";

const ADMIN_PATH = import.meta.env.VITE_ADMIN_API_ENDPOINT || "/admin";

/**
 * User Management APIs
 */
export const adminUserService = {
  /**
   * Get all users (admin only).
   */
  getAllUsers: async ({
    skip = 0,
    limit = 100,
    q,
  }: {
    skip?: number;
    limit?: number;
    q?: string;
  } = {}): Promise<{ data: UserAdminRead[]; total: number }> => {
    const response = await apiClient.get<{ data: UserAdminRead[]; total: number }>(
      `${ADMIN_PATH}/users`,
      {
        params: { skip, limit, q: q ? q : undefined },
      },
    );
    return response.data;
  },

  /**
   * Create a new user (admin only).
   */
  createUser: async (user: UserAdminCreate): Promise<UserAdminRead> => {
    const response = await apiClient.post<UserAdminRead>(`${ADMIN_PATH}/users`, user);
    return response.data;
  },

  /**
   * Get a specific user by ID (admin only).
   */
  getUserById: async (userId: string): Promise<UserAdminRead> => {
    const response = await apiClient.get<UserAdminRead>(`${ADMIN_PATH}/users/${userId}`);
    return response.data;
  },

  /**
   * Update a user (admin only).
   */
  updateUser: async ({
    id,
    data,
  }: {
    id: string;
    data: UserAdminUpdate;
  }): Promise<UserAdminRead> => {
    const response = await apiClient.patch<UserAdminRead>(`${ADMIN_PATH}/users/${id}`, data);
    return response.data;
  },

  /**
   * Delete a user (admin only).
   */
  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`${ADMIN_PATH}/users/${userId}`);
  },
};
