import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminAssociateService } from "@/apis/admin";

export const associateFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  if (slug) {
    await queryClient.ensureQueryData({
      queryKey: [QUERY_KEYS.ADMIN.ASSOCIATES, 0, 1, slug],
      queryFn: () => adminAssociateService.getAllAssociates({ skip: 0, limit: 1, q: slug }),
    });
  }
  return null;
};
