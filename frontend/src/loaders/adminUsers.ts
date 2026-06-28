import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminUserService } from "@/apis/admin";

export const adminUsersLoader = async () => {
  await queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.USERS, 0, 10, ""],
    queryFn: () => adminUserService.getAllUsers(0, 10, ""),
  });
  return null;
};
