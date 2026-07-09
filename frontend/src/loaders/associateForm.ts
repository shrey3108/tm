import { queryClient } from "@/utils/query-client";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { adminAssociateService } from "@/apis/admin";
import { unSlugify } from "@/utils/slug";

export const associateFormLoader = async ({ params }: any) => {
  const slug = params.slug || "";
  const associate = unSlugify(slug);
  if (associate) {
    await queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.ADMIN.ASSOCIATES, 0, 1, associate],
      queryFn: () => adminAssociateService.getAllAssociates({ skip: 0, limit: 1, q: associate }),
    });
  }
  return null;
};
