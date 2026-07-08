import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminSkillService } from "@/apis/admin";

export const adminSkillsLoader = async () => {
  await queryClient.fetchQuery({
    queryKey: [QUERY_KEYS.ADMIN.SKILLS, 0, 10, ""],
    queryFn: () => adminSkillService.getAllSkills({ skip: 0, limit: 10, q: "" }),
  });
  return null;
};
