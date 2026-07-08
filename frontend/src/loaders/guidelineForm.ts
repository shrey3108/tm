import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminGuidelineService } from "@/apis/admin";

export const guidelineFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  if (slug) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.GUIDELINES, 0, 1, slug],
      queryFn: () => adminGuidelineService.getAllGuidelines({ skip: 0, limit: 1, q: slug }),
    });
  }
  return null;
};
