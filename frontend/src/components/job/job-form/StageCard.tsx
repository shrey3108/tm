import {
  GripVertical,
  Trash2,
  Loader2,

  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobStageConfig, StageTemplate } from "@/types/stage";

interface StageCardProps {
  stage: JobStageConfig;
  index: number;
  isDragging: boolean;
  isOver: boolean;
  isRemoving: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
  onShowInfo: (template: StageTemplate) => void;
  onRemove: (configId: string) => void;
}

export const StageCard = ({
  stage,
  index,
  isDragging,
  isOver,
  isRemoving,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onShowInfo,
  onRemove,
}: StageCardProps) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 group",
        "bg-background hover:bg-muted/30",
        isDragging && "opacity-40",
        isOver && "border-primary/50 bg-primary/5",
        !isOver && "border-border",
      )}
    >
      {/* Drag Handle */}
      <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Order Badge */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black">
        {index + 1}
      </div>

      {/* Stage Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-foreground truncate">
          {stage.template?.name || "Unknown Stage"}
        </p>
        {stage.template?.description && (
          <p className="text-xs text-muted-foreground max-w-2xl">
            {stage.template.description}
          </p>
        )}
      </div>

      {/* Mandatory Badge */}
      {/* {stage.is_mandatory && (
        <Badge
          variant="secondary"
          className="shrink-0 text-xs rounded-lg bg-amber-500/10 text-amber-600 border-none font-bold gap-1"
        >
          <Shield className="h-3 w-3" />
          Required
        </Badge>
      )} */}

      {/* Info Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onShowInfo(stage.template)}
        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
      >
        <Info className="h-4 w-4" />
      </Button>

      {/* Remove Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(stage.id)}
        disabled={isRemoving || stage.template?.name === 'Resume Screening'}
        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
      >
        {isRemoving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};
