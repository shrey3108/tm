import { Award, Clock } from "lucide-react";
import type { TaskItem } from "@/types/taskPaper";
import { formatDuration } from "@/utils/taskFormatter";

interface ProjectTaskRichPreviewProps {
  task: TaskItem | string;
  globalIndex?: number;
  showInstructions?: boolean;
}

export function ProjectTaskRichPreview({
  task,
  globalIndex,
  showInstructions = true,
}: ProjectTaskRichPreviewProps) {
  const isString = typeof task === "string";
  const description = isString ? task : task?.task || "";
  const instructions = isString ? "" : task?.instructions || "";
  
  const subTasks = (!isString && task?.tasks) ? task.tasks : [];
  const totalMarks = subTasks.length > 0 ? ((task as TaskItem).total_marks ?? subTasks.reduce((sum, sub) => sum + (sub.marks || 0), 0)) : 0;
  const totalDuration = isString ? 0 : ((task as TaskItem).duration ?? (task as TaskItem).total_duration ?? 0);

  return (
    <div className="space-y-2 flex-1 min-w-0">
      <div>
        <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider block">Project Task / Instruction</span>
        <p className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-wrap mt-0.5">
          {globalIndex !== undefined ? `${globalIndex}. ` : ""}{description}
        </p>
      </div>

      {showInstructions && instructions && (
        <div className="text-xs text-muted-foreground font-medium bg-muted/40 p-2.5 rounded-lg border border-border/40 mt-1">
          <span className="font-bold text-foreground block mb-0.5">Instructions:</span>
          <p className="whitespace-pre-wrap">{instructions}</p>
        </div>
      )}

      {subTasks.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-primary/20 space-y-2">
          <div className="flex flex-wrap gap-2 text-xs font-semibold mb-2">
            <span className="bg-primary/5 text-primary border border-primary/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
              <Award className="h-3 w-3" /> Total Marks: {totalMarks}
            </span>
            {totalDuration > 0 && (
              <span className="bg-primary/5 text-primary border border-primary/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
                <Clock className="h-3 w-3" /> Total Duration: {formatDuration(totalDuration)}
              </span>
            )}
          </div>
          <ul className="space-y-1.5 pl-1.5">
            {subTasks.map((sub, sIdx) => (
              <li key={sIdx} className="text-xs font-semibold text-muted-foreground flex items-start gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0 mt-1.5" />
                <span>
                  {sub.name || (sub as any).title}
                  {sub.marks !== undefined && ` — ${sub.marks} marks`}
                  {sub.description && ` (${sub.description})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
