import { adminSkillService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";

/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useSkill = ({ skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string }) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.SKILLS, skip, limit, q],
        queryFn: () => adminSkillService.getAllSkills({ skip, limit, q }),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.SKILL.staleTime
    })

    return {
        data: res.data?.data ?? [],
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch,
        total: res.data?.total ?? 0
    }
}

/**
 * @param skillId Skill ID
 */
export const useSkillById = (skillId: string) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.SKILLS, skillId],
        queryFn: () => adminSkillService.getSkillById(skillId),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.SKILL.staleTime,
        enabled: !!skillId,
    })

    return {
        data: res.data,
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch
    }
}