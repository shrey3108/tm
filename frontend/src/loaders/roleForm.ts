import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminRoleService } from "@/apis/admin";

export const roleFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  if (slug) {
    await queryClient.ensureQueryData({
      queryKey: [QUERY_KEYS.ADMIN.ROLES, 0, 1, slug],
      queryFn: () => adminRoleService.getAllRoles({ skip: 0, limit: 1, q: slug }),
    });
  }
  return null;
};
