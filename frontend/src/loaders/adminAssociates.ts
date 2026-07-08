import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminAssociateService } from "@/apis/admin";

export const adminAssociatesLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.ASSOCIATES, 0, 10, ""],
    queryFn: () => adminAssociateService.getAllAssociates({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
