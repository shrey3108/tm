import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminDepartmentService, adminJobPriorityService, adminJobPositionService } from "@/apis/admin";
import jobService from "@/apis/job";
import { taskService } from "@/apis/task";
import { slugify } from "@/utils/slug";
import type { LoaderFunctionArgs } from "react-router-dom";

export const jobFormLoader = async ({ params }: LoaderFunctionArgs) => {
  const { jobSlug } = params;

  // Prefetch baseline dependencies
  const deptsPromise = queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, 0, 10, ""],
    queryFn: () => adminDepartmentService.getAllDepartments(0, 10, ""),
  });

  const prioritiesPromise = queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES, 0, 10, ""],
    queryFn: () => adminJobPriorityService.getAllPriorities(0, 10, ""),
  });

  const positionsPromise = queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.POSITIONS, 0, 10, ""],
    queryFn: () => adminJobPositionService.getAllPositions(0, 10, ""),
  });

  const promises: Promise<any>[] = [deptsPromise, prioritiesPromise, positionsPromise];

  if (jobSlug) {
    // We are in Edit Mode. Resolve the job by slug.
    const titlePromise = queryClient.ensureQueryData({
      queryKey: [QUERY_KEYS.JOBS.DETAIL, jobSlug],
      queryFn: () => jobService.getJobTitles(jobSlug),
    }).then(async (response) => {
      const titles = response?.data || [];
      const foundJob = titles.find((j) => slugify(j.title) === jobSlug);
      if (foundJob) {
        // Prefetch job detail
        const detailPromise = queryClient.ensureQueryData({
          queryKey: [QUERY_KEYS.JOBS.DETAIL, foundJob.id],
          queryFn: () => jobService.getJob(foundJob.id),
        });

        // Prefetch job task configuration
        const taskPromise = queryClient.ensureQueryData({
          queryKey: [QUERY_KEYS.JOBS.TASK, foundJob.id],
          queryFn: () => taskService.getJobTask(foundJob.id),
        });

        await Promise.all([detailPromise, taskPromise]);
      }
    });

    promises.push(titlePromise);
  }

  await Promise.all(promises);
  return null;
};
