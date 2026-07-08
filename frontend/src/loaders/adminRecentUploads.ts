import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminAnalyticsService } from "@/apis/admin";

export const adminRecentUploadsLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.RECENT_UPLOADS, 0, 10, ""],
    queryFn: () => adminAnalyticsService.getRecentUploads({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
