import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminUserService } from "@/apis/admin";
import { unSlugify } from "@/utils/slug";

export const userFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  const user = unSlugify(slug)
  if (user) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.USERS, 0, 1, user],
      queryFn: () => adminUserService.getAllUsers({ skip: 0, limit: 1, q: user }),
    });
  }
  return null;
};
