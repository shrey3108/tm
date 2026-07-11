import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminCriteriaService } from "@/apis/admin";

export const adminJobCriteriaLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.CRITERIA, { skip: 0, limit: 10, q: "" }],
    queryFn: () => adminCriteriaService.getAllCriteria({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
