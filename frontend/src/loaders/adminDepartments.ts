import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminDepartmentService } from "@/apis/admin";

export const adminDepartmentsLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, 0, 10, ""],
    queryFn: () => adminDepartmentService.getAllDepartments({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
