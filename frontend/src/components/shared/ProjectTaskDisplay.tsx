import { Clock } from "lucide-react";
import type { TaskItem } from "@/types/taskPaper";
import { formatDuration } from "@/utils/taskFormatter";
import { cn } from "@/lib/utils";

export interface ProjectTaskDisplayProps {
  task: TaskItem | string;
  variant?: "simple" | "detailed";
  titleClassName?: string;
  showTypeSuffix?: boolean;
}

export function ProjectTaskDisplay({
  task,
  variant = "detailed",
  titleClassName,
  showTypeSuffix,
}: ProjectTaskDisplayProps) {
  const isString = typeof task === "string";
  const taskText = isString ? task : task?.task || task?.title || "";
  const instructions = isString ? "" : task?.instructions || "";
  const tDuration = isString ? undefined : task?.duration || task?.total_duration;
  const subTasks = isString ? [] : task?.tasks || [];

  if (variant === "simple") {
    return (
      <div className="text-xs">
        <p className={cn("font-medium text-foreground", titleClassName)}>{taskText}</p>
        {instructions && <p className="text-[10px] text-muted-foreground truncate">{instructions}</p>}
        <span className="text-[10px] text-muted-foreground font-semibold">
          Duration: {tDuration || 30} mins
          {showTypeSuffix && ` • Subtasks: ${subTasks.length} (Project Task)`}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className={cn("font-medium text-foreground whitespace-pre-wrap", titleClassName)}>{taskText}</div>
      {instructions && (
        <div className="pl-2 space-y-0.5 border-l border-border/50">
          <span className="text-xs font-bold block">
            Instructions
          </span>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{instructions}</p>
        </div>
      )}
      {subTasks.length > 0 && (
        <div className="pl-2 space-y-0.5">
          <span className="text-xs font-bold block">
            Sub-tasks
          </span>
          <ul className="list-disc pl-3 text-xs text-muted-foreground space-y-0.5">
            {subTasks.map((st, sIdx) => (
              <li key={sIdx}>
                <span className="font-semibold text-foreground/75">{st.name}</span>
                {st.marks !== undefined && ` (${st.marks} Marks)`}
                {st.description && ` - ${st.description}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {tDuration !== undefined && tDuration > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 text-xs select-none">
          <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
            <Clock className="h-2.5 w-2.5" /> Duration: {formatDuration(tDuration)}
          </span>
        </div>
      )}
    </div>
  );
}
