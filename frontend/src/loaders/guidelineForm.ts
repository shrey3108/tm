import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminGuidelineService } from "@/apis/admin";
import { unSlugify } from "@/utils/slug";

export const guidelineFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  const guideline = unSlugify(slug);
  if (guideline) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.GUIDELINES, 0, 1, guideline],
      queryFn: () => adminGuidelineService.getAllGuidelines({ skip: 0, limit: 1, q: guideline }),
    });
  }
  return null;
};
