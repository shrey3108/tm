import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminJobPriorityService } from "@/apis/admin";
import { unSlugify } from "@/utils/slug";

export const priorityFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  const priority = unSlugify(slug);
  if (priority) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES, 0, 1, priority],
      queryFn: () => adminJobPriorityService.getAllPriorities({ skip: 0, limit: 1, q: priority }),
    });
  }
  return null;
};
