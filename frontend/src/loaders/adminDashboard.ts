import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminAnalyticsService, adminStageTemplateService } from "@/apis/admin";
import jobService from "@/apis/job";

export const adminDashboardLoader = async () => {
  // Prefetch dashboard summary and hiring report
  const dashboardPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.DASHBOARD_DATA],
    queryFn: async () => {
      const [analytics, report] = await Promise.all([
        adminAnalyticsService.getAnalytics(),
        adminAnalyticsService.getHiringReport(undefined, undefined),
      ]);
      return { analytics, report };
    },
  });

  // Prefetch job titles
  const jobTitlesPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.JOBS.DETAIL, ""],
    queryFn: () => jobService.getJobTitles(""),
  });

  // Prefetch stage templates
  const stageTemplatesPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.STAGES, 0, 100, ""],
    queryFn: () => adminStageTemplateService.getAllTemplates(0, 100, ""),
  });

  await Promise.all([dashboardPromise, jobTitlesPromise, stageTemplatesPromise]);
  return null;
};
