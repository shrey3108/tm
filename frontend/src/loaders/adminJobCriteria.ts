import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminCriteriaService } from "@/apis/admin";

export const adminJobCriteriaLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.CRITERIA, 0, 10, ""],
    queryFn: () => adminCriteriaService.getAllCriteria(0, 10, ""),
  });
  return null;
};
