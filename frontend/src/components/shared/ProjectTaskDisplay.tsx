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
      <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4 w-full text-xs">
        <div className="min-w-0">
          <p className={cn("text-foreground text-wrap wrap-break-word text-sm", titleClassName)}>{taskText}</p>
          {instructions && <p className="text-xs text-wrap wrap-break-word mt-0.5">{instructions}</p>}
          {showTypeSuffix && (
            <span className="text-xs block mt-0.5 text-muted-foreground">
              Subtasks: {subTasks.length} (Project Task)
            </span>
          )}
          <span className="text-xs mt-0.5">Tasks</span>
          <ul className="list-disc pl-3 text-xs space-y-0.5">
            {subTasks.map((st, sIdx) => (
              <li key={sIdx}>
                <div className="flex items-center">
                  <span>{st.name}</span>
                  <span>{st.marks !== undefined && ` (${st.marks} Marks)`}</span>
                </div>
                {/* {st.description && ` - ${st.description}`} */}
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 text-left whitespace-nowrap text-xs self-start pt-0.5">
          Marks: {calculatedTotalMarks ?? "N/A"} • Duration: {tDuration || 30} mins
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4 w-full">
      <div className="min-w-0 space-y-1">
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
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 text-xs select-none whitespace-nowrap self-start">
        <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
          <Award className="h-2.5 w-2.5" /> {calculatedTotalMarks !== undefined ? `${calculatedTotalMarks} Marks` : "N/A Marks"}
        </span>
        <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
          <Clock className="h-2.5 w-2.5" /> {tDuration !== undefined && tDuration > 0 ? formatDuration(tDuration) : formatDuration(30)}
        </span>
      </div>
    </div>
  );
}
