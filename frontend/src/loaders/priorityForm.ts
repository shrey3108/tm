import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminJobPriorityService } from "@/apis/admin";

export const priorityFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  if (slug) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES, 0, 1, slug],
      queryFn: () => adminJobPriorityService.getAllPriorities({ skip: 0, limit: 1, q: slug }),
    });
  }
  return null;
};
