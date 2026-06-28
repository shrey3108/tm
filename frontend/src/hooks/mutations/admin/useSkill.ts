import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSkillService } from "@/apis/admin";
import type { SkillCreate, SkillUpdate } from "@/types/skill";
import { QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Hook for creating a skill.
 */
export function useCreateSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SkillCreate) => adminSkillService.createSkill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.SKILLS] });
    },
  });
}

/**
 * Hook for updating an existing skill.
 */
export function useUpdateSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SkillUpdate }) =>
      adminSkillService.updateSkill(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.SKILLS] });
    },
  });
}

/**
 * Hook for deleting a skill.
 */
export function useDeleteSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminSkillService.deleteSkill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN.SKILLS] });
    },
  });
}
