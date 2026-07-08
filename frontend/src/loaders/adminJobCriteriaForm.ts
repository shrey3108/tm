import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminCriteriaService } from "@/apis/admin";

export const adminJobCriteriaFormLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.CRITERIA, 0, 100, ""],
    queryFn: () => adminCriteriaService.getAllCriteria(0, 100, ""),
  });
  return null;
};
