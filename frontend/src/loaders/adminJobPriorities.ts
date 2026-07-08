import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminJobPriorityService } from "@/apis/admin";

export const adminJobPrioritiesLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES, 0, 10, ""],
    queryFn: () => adminJobPriorityService.getAllPriorities({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
