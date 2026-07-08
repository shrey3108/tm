import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminJobPositionService } from "@/apis/admin";

export const positionFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  if (slug) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.POSITIONS, 0, 1, slug],
      queryFn: () => adminJobPositionService.getAllPositions({ skip: 0, limit: 1, q: slug }),
    });
  }
  return null;
};
