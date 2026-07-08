import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminSkillService } from "@/apis/admin";
import { unSlugify } from "@/utils/slug";

export const skillFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  const skill = unSlugify(slug)
  if (skill) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.SKILLS, 0, 1, skill],
      queryFn: () => adminSkillService.getAllSkills({ q: skill }),
    });
  }
  return null;
};
