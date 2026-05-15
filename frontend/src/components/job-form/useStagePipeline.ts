import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { adminJobService } from "@/apis/admin/job";
import { adminStageTemplateService } from "@/apis/admin/stageTemplate";
import { jobStageService } from "@/apis/jobStage";
import type { JobStageConfig, StageTemplate } from "@/types/stage";

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
  const [templates, setTemplates] = useState<StageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingDefaults, setIsSettingDefaults] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  const fetchStages = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await adminJobService.getJobStages(jobId);
      setStages(data.sort((a, b) => a.stage_order - b.stage_order));
    } catch (error) {
      console.error("Failed to fetch job stages:", error);
      toast.error("Failed to load interview stages");
    }
  }, [jobId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await adminStageTemplateService.getAllTemplates();
      setTemplates(data.data);
      return data.data;
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      return [];
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const [, fetchedTemplates] = await Promise.all([fetchStages(), fetchTemplates()]);

      // Auto-populate default stages in create mode if stages are empty
      if (!jobId && stages.length === 0 && fetchedTemplates.length > 0) {
        const defaultTemplates = fetchedTemplates
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

      setIsLoading(false);
    };
    init();
    // Only run on mount to avoid infinite loops with onChange/stages
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

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

    setIsAdding(true);
    try {
      // Add stages in parallel since explicit
      await Promise.all(
        selectedTemplates.map((template, i) =>
          adminJobService.addStageToJob(jobId, {
            template_id: template.id,
            stage_order: stages.length + i + 1,
            is_mandatory: true,
          }),
        ),
      );

      toast.success(`${selectedTemplates.length} stage(s) added to pipeline`);
      setSelectedTemplateIds([]);
      await fetchStages();
    } catch (error) {
      console.error("Failed to add stages:", error);
      toast.error("Failed to add all stages");
    } finally {
      setIsAdding(false);
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
      await adminJobService.removeStageFromJob(jobId, configId);
      toast.success("Stage removed from pipeline");
      await fetchStages();
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

    setIsSettingDefaults(true);
    try {
      // Remove all existing stages in parallel first to ensure a clean default setup
      if (stages.length > 0) {
        await Promise.all(stages.map((s) => adminJobService.removeStageFromJob(jobId, s.id)));
      }

      await jobStageService.setupDefaultStages(jobId);
      toast.success("Default pipeline configured");
      await fetchStages();
    } catch (error) {
      console.error("Failed to setup defaults:", error);
      toast.error("Failed to setup default pipeline");
    } finally {
      setIsSettingDefaults(false);
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
      await adminJobService.reorderJobStages(jobId, {
        stage_ids: updated.map((s) => s.id),
      });
      toast.success("Pipeline reordered");
    } catch (error) {
      console.error("Failed to reorder stages:", error);
      toast.error("Failed to reorder — reverting");
      await fetchStages(); // rollback
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
