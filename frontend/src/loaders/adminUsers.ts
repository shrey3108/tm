import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminUserService } from "@/apis/admin";

export const adminUsersLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.USERS, 0, 10, ""],
    queryFn: () => adminUserService.getAllUsers({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
