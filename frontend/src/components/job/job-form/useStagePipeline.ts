import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { JobStageConfig } from "@/types/stage";

// TanStack Query Hooks
import { useJobStage } from "@/hooks/queries/admin/useJobStage";
import { useJobStages } from "@/hooks/queries/jobs/useJob";
import {
  useAddStageMutation,
  useRemoveStageMutation,
  useSetupDefaultStagesMutation,
  useReorderStagesMutation,
} from "@/hooks/mutations/jobs/useJobMutations";

interface UseStagePipelineOptions {
  /** Job ID — null in create mode before the job is saved */
  jobId: string | null;
  /** Callback for when stages change (used in create mode) */
  onChange?: (stages: any[] | null) => void;
}

/** Serialise a stage config for the onChange callback. */
const toStagePayload = (s: JobStageConfig) => ({
  template_id: s.template_id,
  stage_order: s.stage_order,
  is_mandatory: s.is_mandatory,
  config: s.config || {},
});

export const useStagePipeline = ({ jobId, onChange }: UseStagePipelineOptions) => {
  const [stages, setStages] = useState<JobStageConfig[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  // TanStack Queries
  const { data: templates, loading: templatesLoading } = useJobStage(0, 100);
  const { data: dbStages, loading: stagesLoading, refetch: refetchStages } = useJobStages(jobId);

  const isLoading = templatesLoading || (!!jobId && stagesLoading);

  // TanStack Mutations
  const addStageMutation = useAddStageMutation();
  const removeStageMutation = useRemoveStageMutation();
  const setupDefaultsMutation = useSetupDefaultStagesMutation();
  const reorderStagesMutation = useReorderStagesMutation();

  const isAdding = addStageMutation.isPending;
  const isSettingDefaults = setupDefaultsMutation.isPending;

  // Sync DB stages to local state when jobId is present
  useEffect(() => {
    if (jobId && dbStages) {
      setStages([...dbStages].sort((a, b) => a.stage_order - b.stage_order));
    }
  }, [jobId, dbStages]);

  // Auto-populate default stages in create mode if stages are empty
  useEffect(() => {
    if (!jobId && stages.length === 0 && templates.length > 0) {
      const defaultTemplates = templates
        .filter((t) => t.is_default)
        .sort((a, b) => (a.default_order || 0) - (b.default_order || 0)); // TBD: on backend response 

      if (defaultTemplates.length > 0) {
        const newStages: JobStageConfig[] = defaultTemplates.map((template, index) => ({
          id: crypto.randomUUID(),
          job_id: "",
          template_id: template.id,
          stage_order: index + 1,
          is_mandatory: true,
          template: template,
          config: template.config || { evaluation_criteria: [] },
        }));
        setStages(newStages);
        onChange?.(newStages.map(toStagePayload));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, templates]);

  // Templates not yet added to this job
  const availableTemplates = templates.filter(
    (t) => !stages.some((s) => s.template_id === t.id),
  );

  const handleAddStage = async () => {
    if (selectedTemplateIds.length === 0) return;

    const selectedTemplates = templates.filter((t) => selectedTemplateIds.includes(t.id));
    if (selectedTemplates.length === 0) return;

    if (!jobId) {
      // Local mode
      const newStages: JobStageConfig[] = selectedTemplates.map((template, index) => ({
        id: crypto.randomUUID(),
        job_id: "",
        template_id: template.id,
        stage_order: stages.length + index + 1,
        is_mandatory: true,
        template: template,
        config: template.config || {},
      }));

      const updated = [...stages, ...newStages];
      setStages(updated);
      setSelectedTemplateIds([]);
      onChange?.(updated.map(toStagePayload));
      toast.success(`${selectedTemplates.length} stage(s) added to pipeline`);
      return;
    }

    try {
      // Add stages in parallel since explicit
      await Promise.all(
        selectedTemplates.map((template, i) =>
          addStageMutation.mutateAsync({
            jobId,
            templateId: template.id,
            stageOrder: stages.length + i + 1,
          })
        )
      );

      toast.success(`${selectedTemplates.length} stage(s) added to pipeline`);
      setSelectedTemplateIds([]);
      await refetchStages();
    } catch (error) {
      console.error("Failed to add stages:", error);
      toast.error("Failed to add all stages");
    }
  };

  const handleRemoveStage = async (configId: string) => {
    if (!jobId) {
      // Local mode
      const updated = stages
        .filter((s) => s.id !== configId)
        .map((s, idx) => ({ ...s, stage_order: idx + 1 }));
      setStages(updated);
      onChange?.(updated.map(toStagePayload));
      return;
    }

    setRemovingId(configId);
    try {
      await removeStageMutation.mutateAsync({ jobId, configId });
      toast.success("Stage removed from pipeline");
      await refetchStages();
    } catch (error) {
      console.error("Failed to remove stage:", error);
      toast.error("Failed to remove stage");
    } finally {
      setRemovingId(null);
    }
  };

  const handleSetupDefaults = async () => {
    if (!jobId) {
      // Local mode
      setStages([]);
      onChange?.(null); // null means "use auto-defaults" in backend
      toast.info("Backend will auto-configure default stages on creation");
      return;
    }

    try {
      // Remove all existing stages in parallel first to ensure a clean default setup
      if (stages.length > 0) {
        await Promise.all(stages.map((s) => removeStageMutation.mutateAsync({ jobId, configId: s.id })));
      }

      await setupDefaultsMutation.mutateAsync(jobId);
      toast.success("Default pipeline configured");
      await refetchStages();
    } catch (error) {
      console.error("Failed to setup defaults:", error);
      toast.error("Failed to setup default pipeline");
    }
  };

  /** Apply a reordered stages array (from drag-and-drop). */
  const applyReorder = async (reordered: JobStageConfig[]) => {
    const updated = reordered.map((s, idx) => ({ ...s, stage_order: idx + 1 }));
    setStages(updated);

    if (!jobId) {
      onChange?.(updated.map(toStagePayload));
      return;
    }

    // Persist via API
    try {
      await reorderStagesMutation.mutateAsync({ jobId, stageIds: updated.map((s) => s.id) });
      toast.success("Pipeline reordered");
    } catch (error) {
      console.error("Failed to reorder stages:", error);
      toast.error("Failed to reorder — reverting");
      await refetchStages(); // rollback
    }
  };

  return {
    stages,
    templates,
    availableTemplates,
    isLoading,
    isAdding,
    isSettingDefaults,
    removingId,
    selectedTemplateIds,
    setSelectedTemplateIds,
    handleAddStage,
    handleRemoveStage,
    handleSetupDefaults,
    applyReorder,
  };
};

