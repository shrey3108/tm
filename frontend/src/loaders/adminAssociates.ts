import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminAssociateService } from "@/apis/admin";

export const adminAssociatesLoader = async () => {
  await queryClient.ensureQueryData({
    queryKey: [QUERY_KEYS.ADMIN.ASSOCIATES, 0, 10, ""],
    queryFn: () => adminAssociateService.getAllAssociates(0, 10, ""),
  });
  return null;
};
