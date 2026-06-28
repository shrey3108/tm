import { useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { StageDetailDialog } from "@/components/admin/StageDetailDialog";
import type { StageTemplate } from "@/types/stage";

import { useStagePipeline } from "./useStagePipeline";
import { useStageDragDrop } from "./useStageDragDrop";
import { StageCard } from "./StageCard";
import { AddStageDropdown } from "./AddStageDropdown";

interface StagePipelineSectionProps {
  /** Job ID — null in create mode before the job is saved */
  jobId: string | null;
  /** Callback for when stages change (used in create mode) */
  onChange?: (stages: any[] | null) => void;
}

/**
 * Manages the interview stage pipeline for a specific job.
 * Supports add, remove, reorder (native drag-and-drop), and setup defaults.
 */
export const StagePipelineSection = ({ jobId, onChange }: StagePipelineSectionProps) => {
  const {
    stages,
    availableTemplates,
    isLoading,
    isAdding,
    // isSettingDefaults,
    removingId,
    selectedTemplateIds,
    setSelectedTemplateIds,
    handleAddStage,
    handleRemoveStage,
    // handleSetupDefaults,
    applyReorder,
  } = useStagePipeline({ jobId, onChange });

  const {
    dragIndex,
    overIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useStageDragDrop({ stages, onReorder: applyReorder });

  const [selectedTemplate, setSelectedTemplate] = useState<StageTemplate | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleShowInfo = (template: StageTemplate) => {
    setSelectedTemplate(template);
    setIsDetailOpen(true);
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="app-surface-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight">Interview Pipeline</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground font-medium">Loading stages...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-surface-card space-y-5 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">Interview Pipeline</h2>
          </div>
          <p className="text-muted-foreground text-base font-medium mt-0.5">
            Configure the interview stages for this job. Reorder or add more as needed.
          </p>
        </div>
      </div>

      {/* Add Stage */}
      <AddStageDropdown
        availableTemplates={availableTemplates}
        selectedTemplateIds={selectedTemplateIds}
        onSelectionChange={setSelectedTemplateIds}
        onAdd={handleAddStage}
        isAdding={isAdding}
      />

      {/* Stage List */}
      {stages.length === 0 ? (
        <div className="py-12 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-muted-foreground/10">
          <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            No stages configured yet.
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Add stages above to start building your pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {stages.map((stage, index) => (
            <StageCard
              key={stage.id}
              stage={stage}
              index={index}
              isDragging={dragIndex === index}
              isOver={overIndex === index}
              isRemoving={removingId === stage.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onShowInfo={handleShowInfo}
              onRemove={handleRemoveStage}
            />
          ))}
        </div>
      )}
      {/* Info Dialog */}
      <StageDetailDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        template={selectedTemplate}
      />
    </div>
  );
};
