import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminCriteriaService } from "@/apis/admin";

export const adminJobCriteriaFormLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.CRITERIA, { skip: 0, limit: 100, q: "" }],
    queryFn: () => adminCriteriaService.getAllCriteria({ skip: 0, limit: 100, q: "" }),
  });
  return null;
};
