import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminJobPositionService } from "@/apis/admin";
import { unSlugify } from "@/utils/slug";

export const positionFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  const position = unSlugify(slug);
  if (position) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.POSITIONS, 0, 1, position],
      queryFn: () => adminJobPositionService.getAllPositions({ skip: 0, limit: 1, q: position }),
    });
  }
  return null;
};
