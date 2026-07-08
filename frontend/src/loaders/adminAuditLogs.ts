import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminAnalyticsService } from "@/apis/admin";

export const adminAuditLogsLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.AUDIT_LOGS, 0, 10, ""],
    queryFn: () => adminAnalyticsService.getAuditLogs({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
