import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminDepartmentService } from "@/apis/admin";
import { unSlugify } from "@/utils/slug";

export const departmentFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  const department = unSlugify(slug)
  if (department) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, 0, 1, department],
      queryFn: () => adminDepartmentService.getAllDepartments({ q: department }),
    });
  }
  return null;
};
