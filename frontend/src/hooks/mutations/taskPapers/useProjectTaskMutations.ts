import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "@/apis/task";
import { QUERY_KEYS } from "@/constants/queryKeys";
import type {
    TaskItem
} from "@/types/taskPaper";

/**
 * Hook to add a project task to a predefined question set paper.
 */
export function useAddProjectTaskToPaperMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            paperId,
            projectTask,
            skillIds,
        }: {
            paperId: string;
            projectTask: TaskItem | string;
            skillIds?: string[];
        }) => taskService.addProjectTaskToPaper(paperId, projectTask, skillIds),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
            });
        },
    });
}

/**
 * Hook to update a project task in a predefined question set paper.
 */
export function useUpdateProjectTaskInPaperMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            paperId,
            index,
            projectTask,
            skillIds,
        }: {
            paperId: string;
            index: number;
            projectTask: TaskItem | string;
            skillIds?: string[];
        }) => taskService.updateProjectTaskInPaper(paperId, index, projectTask, skillIds),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
                refetchType: "all",
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
                refetchType: "all",
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
                refetchType: "all",
            });
        },
    });
}

/**
 * Hook to delete a project task from a predefined question set paper.
 */
export function useDeleteProjectTaskFromPaperMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            paperId,
            index,
        }: {
            paperId: string;
            index: number;
        }) => taskService.deleteProjectTaskFromPaper(paperId, index),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.LIST],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.DETAIL, variables.paperId],
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.TASK_PAPERS.ALL_CONTENT],
            });
        },
    });
}



