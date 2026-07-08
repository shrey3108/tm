import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminUserService } from "@/apis/admin";

export const userFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  if (slug) {
    await queryClient.ensureQueryData({
      queryKey: [QUERY_KEYS.ADMIN.USERS, 0, 1, slug],
      queryFn: () => adminUserService.getAllUsers({ skip: 0, limit: 1, q: slug }),
    });
  }
  return null;
};
