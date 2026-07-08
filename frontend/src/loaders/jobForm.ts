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
  const deptsPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, 0, 10, ""],
    queryFn: () => adminDepartmentService.getAllDepartments({ skip: 0, limit: 10, q: "" }),
  });

  const prioritiesPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.JOB_PRIORITIES, 0, 10, ""],
    queryFn: () => adminJobPriorityService.getAllPriorities({ skip: 0, limit: 10, q: "" }),
  });

  const positionsPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.POSITIONS, 0, 10, ""],
    queryFn: () => adminJobPositionService.getAllPositions({ skip: 0, limit: 10, q: "" }),
  });

  const promises: Promise<any>[] = [deptsPromise, prioritiesPromise, positionsPromise];

  if (jobSlug) {
    // We are in Edit Mode. Resolve the job by slug.
    const titlePromise = queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.JOBS.DETAIL, jobSlug],
      queryFn: () => jobService.getJobTitles(jobSlug),
    }).then(async (response) => {
      const titles = response?.data || [];
      const foundJob = titles.find((j) => slugify(j.title) === jobSlug);
      if (foundJob) {
        // Prefetch job detail
        const detailPromise = queryClient.fetchQuery({
          queryKey: [QUERY_KEYS.JOBS.DETAIL, foundJob.id],
          queryFn: () => jobService.getJob(foundJob.id),
        });

        // Prefetch job task configuration
        const taskPromise = queryClient.fetchQuery({
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
