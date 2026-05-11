import apiClient from "@/apis/client";
import type { AdminCacheDeleteResponse, AdminCacheKeysResponse } from "@/types/admin-system";


const ADMIN_PATH = import.meta.env.VITE_ADMIN_API_ENDPOINT || "/admin";

/**
 * System APIs
 */
export const adminSystemService = {
    /**
     * Clear the entire system cache (Redis).
     * Requires: `system:manage` permission.
     */
    clearCache: async (pattern?: string): Promise<AdminCacheDeleteResponse> => {
        const params = pattern ? { pattern } : undefined;
        return await apiClient.delete(`${ADMIN_PATH}/cache`, { params });
    },

    /**
     * Get all keys from the cache.
     * 
     */
    getAllKeys: async (pattern?: string): Promise<AdminCacheKeysResponse> => {
        const params = pattern ? { pattern } : undefined;
        const res = await apiClient.get<AdminCacheKeysResponse>(`${ADMIN_PATH}/cache`, { params });
        return res.data;
    }
};
