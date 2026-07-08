import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminCriteriaService, adminStageTemplateService } from "@/apis/admin";

export const adminJobStageFormLoader = async () => {
  const criteriaPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.CRITERIA, 0, 100, ""],
    queryFn: () => adminCriteriaService.getAllCriteria(0, 100, ""),
  });

  const stagesPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.STAGES, 0, 100, ""],
    queryFn: () => adminStageTemplateService.getAllTemplates(0, 100, ""),
  });

  await Promise.all([criteriaPromise, stagesPromise]);
  return null;
};
