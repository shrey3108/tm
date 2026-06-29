import { Clock, Award } from "lucide-react";
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
  variant = "simple",
  titleClassName,
  showTypeSuffix = true,
}: ProjectTaskDisplayProps) {
  const isString = typeof task === "string";
  const taskText = isString ? task : task?.task || task?.title || "";
  const instructions = isString ? "" : task?.instructions || "";
  const tDuration = isString ? undefined : task?.duration || task?.total_duration;
  const subTasks = isString ? [] : task?.tasks || [];

  const calculatedTotalMarks = isString
    ? undefined
    : (task?.total_marks || task?.tasks?.reduce((sum, st) => sum + (st.marks || 0), 0) || undefined);

  if (variant === "simple") {
    return (
      <div className="flex items-start justify-between gap-4 w-full">
        <div className="flex-1 min-w-0">
          <p className={cn("text-foreground text-wrap wrap-break-word", titleClassName)}>{taskText}</p>
          {instructions && <p className="text-xs truncate mt-0.5">{instructions}</p>}
          {showTypeSuffix && (
            <span className="text-xs block mt-0.5">
              Subtasks: {subTasks.length} (Project Task)
            </span>
          )}
        </div>
        <div className="shrink-0 text-right whitespace-nowrap text-xs self-start pt-0.5">
          {calculatedTotalMarks !== undefined && calculatedTotalMarks > 0 && `Marks: ${calculatedTotalMarks} • `}Duration: {tDuration || 30} mins
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 w-full">
      <div className="flex-1 min-w-0 space-y-1">
        <div className={cn("font-medium text-foreground text-wrap wrap-break-word whitespace-pre-wrap", titleClassName)}>{taskText}</div>
        {instructions && (
          <div className="pl-2 space-y-0.5 border-l border-border/50">
            <span className="text-xs block">
              Instructions
            </span>
            <p className="text-xs whitespace-pre-wrap">{instructions}</p>
          </div>
        )}
        {subTasks.length > 0 && (
          <div className="pl-2 space-y-0.5">
            <span className="text-xs block">
              Sub-tasks
            </span>
            <ul className="list-disc pl-3 text-xs  space-y-0.5">
              {subTasks.map((st, sIdx) => (
                <li key={sIdx}>
                  <span className="text-foreground/75">{st.name}</span>
                  {st.marks !== undefined && ` (${st.marks} Marks)`}
                  {st.description && ` - ${st.description}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {((calculatedTotalMarks !== undefined && calculatedTotalMarks > 0) || (tDuration !== undefined && tDuration > 0)) && (
        <div className="shrink-0 flex items-center gap-1.5 text-xs select-none whitespace-nowrap self-start">
          {calculatedTotalMarks !== undefined && calculatedTotalMarks > 0 && (
            <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
              <Award className="h-2.5 w-2.5" /> {calculatedTotalMarks} Marks
            </span>
          )}
          {tDuration !== undefined && tDuration > 0 && (
            <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
              <Clock className="h-2.5 w-2.5" /> Duration: {formatDuration(tDuration)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
