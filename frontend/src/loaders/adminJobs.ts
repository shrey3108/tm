import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminJobService } from "@/apis/admin";

export const adminJobsLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.JOBS.ADMIN_LIST, 0, 10, undefined],
    queryFn: () => adminJobService.getAllJobs(0, 10, undefined),
  });
  return null;
};
