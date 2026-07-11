import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminStageTemplateService } from "@/apis/admin";

export const adminJobStagesLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.STAGES, { skip: 0, limit: 100, q: "" }],
    queryFn: () => adminStageTemplateService.getAllTemplates({ skip: 0, limit: 100, q: "" }),
  });
  return null;
};
