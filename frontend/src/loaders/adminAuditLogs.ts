import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminAnalyticsService } from "@/apis/admin";

export const adminAuditLogsLoader = async () => {
  await queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.AUDIT_LOGS, 0, 10, ""],
    queryFn: () => adminAnalyticsService.getAuditLogs(0, 10, ""),
  });
  return null;
};
