import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminCriteriaService, adminStageTemplateService } from "@/apis/admin";

export const adminJobStageFormLoader = async () => {
  const criteriaPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.CRITERIA, 0, 100, ""],
    queryFn: () => adminCriteriaService.getAllCriteria({ skip: 0, limit: 100, q: "" }),
  });

  const stagesPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.STAGES, { skip: 0, limit: 100, q: "" }],
    queryFn: () => adminStageTemplateService.getAllTemplates({ skip: 0, limit: 100, q: "" }),
  });

  await Promise.all([criteriaPromise, stagesPromise]);
  return null;
};
