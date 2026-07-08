import { adminDepartmentService } from "@/apis/admin";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { QUERY_CONFIG } from "@/constants/queryConfig";
/**
 * @param skip number of records to skip
 * @param limit number of records to fetch
 * @param q query string
 */
export const useDepartment = ({ skip = 0, limit = 10, q }: { skip?: number; limit?: number; q?: string }) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, skip, limit, q],
        queryFn: () => adminDepartmentService.getAllDepartments({ skip, limit, q }),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.DEPARTMENT.staleTime
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
 * @param departmentId Department ID
 */
export const useDepartmentById = (departmentId: string) => {
    const res = useQuery({
        queryKey: [QUERY_KEYS.ADMIN.DEPARTMENTS, departmentId],
        queryFn: () => adminDepartmentService.getDepartmentById(departmentId),
        placeholderData: keepPreviousData,
        staleTime: QUERY_CONFIG.DEPARTMENT.staleTime,
        enabled: !!departmentId,
    })

    return {
        data: res.data,
        loading: res.isLoading,
        error: res.error,
        refetch: res.refetch
    }
}