import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminRoleService } from "@/apis/admin";
import { unSlugify } from "@/utils/slug";

export const roleFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  const role = unSlugify(slug)
  if (role) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.ROLES, 0, 1, role],
      queryFn: () => adminRoleService.getAllRoles({ skip: 0, limit: 1, q: role }),
    });
  }
  return null;
};
