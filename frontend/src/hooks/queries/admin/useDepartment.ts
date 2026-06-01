import { adminDepartmentService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useDepartment = (skip: number, limit: number, q: string) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, skip, limit, q],
        queryFn: () => adminDepartmentService.getAllDepartments(skip, limit, q),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 // 1 minute
    })

    return {
        data: res.data?.data ?? [],
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch,
        total: res.data?.total ?? 0
    }
}