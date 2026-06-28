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
  getAllUsers: async (
    skip: number = 0,
    limit: number = 100,
    search?: string,
  ): Promise<{ data: UserAdminRead[]; total: number }> => {
    const response = await apiClient.get<{ data: UserAdminRead[]; total: number }>(
      `${ADMIN_PATH}/users`,
      {
        params: { skip, limit, q: search ? search : undefined },
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
  updateUser: async (userId: string, user: UserAdminUpdate): Promise<UserAdminRead> => {
    const response = await apiClient.patch<UserAdminRead>(`${ADMIN_PATH}/users/${userId}`, user);
    return response.data;
  },

  /**
   * Delete a user (admin only).
   */
  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`${ADMIN_PATH}/users/${userId}`);
  },
};
