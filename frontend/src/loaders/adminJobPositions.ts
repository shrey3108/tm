import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminJobPositionService } from "@/apis/admin";

export const adminJobPositionsLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.POSITIONS, 0, 10, ""],
    queryFn: () => adminJobPositionService.getAllPositions({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
