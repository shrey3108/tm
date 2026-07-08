import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminDepartmentService } from "@/apis/admin";

export const departmentFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  if (slug) {
    await queryClient.ensureQueryData({
      queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, 0, 1, slug],
      queryFn: () => adminDepartmentService.getAllDepartments({ q: slug }),
    });
  }
  return null;
};
