import { adminAnalyticsService } from "@/apis/admin";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

export const useAdminDashboardData = () => {
  const res = useQuery({
    queryKey: [QUERY_KEYS.ADMIN.DASHBOARD_DATA],
    queryFn: async () => {
      const [analytics, report] = await Promise.all([
        adminAnalyticsService.getAnalytics(),
        adminAnalyticsService.getHiringReport(undefined, undefined),
      ]);
      return { analytics, report };
    },
    staleTime: 1000 * 60, // 1 minute
  });

  return {
    analytics: res.data?.analytics,
    report: res.data?.report,
    loading: res.isLoading,
    error: res.error,
    refetch: res.refetch,
  };
};
