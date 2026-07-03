import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminGuidelineService } from "@/apis/admin";

export const adminGuidelinesLoader = async () => {
  await queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.GUIDELINES, 0, 10, ""],
    queryFn: () => adminGuidelineService.getAllGuidelines(0, 10, ""),
  });
  return null;
};
