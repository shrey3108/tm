import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { taskService } from "@/apis/task";
import { adminDepartmentService, adminJobPositionService } from "@/apis/admin";

export const questionsBankLoader = async () => {
  const papersPromise = queryClient.fetchQuery({
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

  const departmentsPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, 0, 100, ""],
    queryFn: () => adminDepartmentService.getAllDepartments({ skip: 0, limit: 100, q: "" }),
  });

  const positionsPromise = queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.POSITIONS, 0, 100, ""],
    queryFn: () => adminJobPositionService.getAllPositions({ skip: 0, limit: 100, q: "" }),
  });

  await Promise.all([papersPromise, departmentsPromise, positionsPromise]);
  return null;
};
