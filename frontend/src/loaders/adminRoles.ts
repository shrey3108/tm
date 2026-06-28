import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminRoleService } from "@/apis/admin";

export const adminRolesLoader = async () => {
  await queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.ROLES, 0, 10, ""],
    queryFn: () => adminRoleService.getAllRoles(0, 10, ""),
  });
  return null;
};
