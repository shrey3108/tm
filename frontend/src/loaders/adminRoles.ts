import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminRoleService } from "@/apis/admin";

export const adminRolesLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.ROLES, 0, 10, ""],
    queryFn: () => adminRoleService.getAllRoles({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
