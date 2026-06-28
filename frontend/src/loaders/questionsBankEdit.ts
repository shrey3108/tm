import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { taskService } from "@/apis/task";
import { adminDepartmentService, adminJobPositionService } from "@/apis/admin";

export const questionsBankEditLoader = async () => {
  const departmentsPromise = queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, 0, 100, ""],
    queryFn: () => adminDepartmentService.getAllDepartments(0, 100, ""),
  });

  const positionsPromise = queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.POSITIONS, 0, 100, ""],
    queryFn: () => adminJobPositionService.getAllPositions(0, 100, ""),
  });

  const allPapersPromise = queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.TASK_PAPERS.LIST, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined],
    queryFn: () =>
      taskService.getQuestionSetPapers({
        jobId: undefined,
        positionId: undefined,
        departmentId: undefined,
        skillId: undefined,
        paperType: undefined,
        q: undefined,
        skip: undefined,
        limit: undefined,
      }),
  });

  await Promise.all([departmentsPromise, positionsPromise, allPapersPromise]);
  return null;
};
