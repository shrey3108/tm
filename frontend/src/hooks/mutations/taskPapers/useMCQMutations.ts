import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "@/apis/task";
import { QUERY_KEYS } from "@/constants/queryKeys";
import type {
    MCQItem
} from "@/types/taskPaper";

/**
 * Hook to add a new MCQ to a predefined question set paper.
 */
export function useAddMCQToPaperMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            paperId,
            mcq,
            skillIds,
        }: {
            paperId: string;
            mcq: MCQItem;
            skillIds?: string[];
        }) => taskService.addMCQToPaper(paperId, mcq, skillIds),
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
 * Hook to update an MCQ in a predefined question set paper.
 */
export function useUpdateMCQInPaperMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            paperId,
            index,
            mcq,
            skillIds,
        }: {
            paperId: string;
            index: number;
            mcq: MCQItem;
            skillIds?: string[];
        }) => taskService.updateMCQInPaper(paperId, index, mcq, skillIds),
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
 * Hook to delete an MCQ from a predefined question set paper.
 */
export function useDeleteMCQFromPaperMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            paperId,
            index,
        }: {
            paperId: string;
            index: number;
        }) => taskService.deleteMCQFromPaper(paperId, index),
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

