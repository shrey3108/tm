import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminStageTemplateService } from "@/apis/admin";

export const adminJobStagesLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.STAGES, 0, 10, ""],
    queryFn: () => adminStageTemplateService.getAllTemplates(0, 10, ""),
  });
  return null;
};
