import { CheckCircle2, ListChecks, Loader2 } from "lucide-react";
import type { QuestionItem, MCQItem, TaskItem } from "@/types/taskPaper";
import { cn } from "@/lib/utils";
import { SingleQuestionDisplay } from "./SingleQuestionDisplay";
import { MCQQuestionDisplay } from "./MCQQuestionDisplay";
import { ProjectTaskDisplay } from "./ProjectTaskDisplay";

interface PaperContentDisplayProps {
  questions?: (QuestionItem | string)[];
  mcqs?: MCQItem[];
  project_task?: (TaskItem | string)[];
  className?: string;
}

export function PaperContentDisplay({
  questions = [],
  mcqs = [],
  project_task = [],
  className,
}: PaperContentDisplayProps) {
  return (
    <div className={cn("space-y-2 animate-in fade-in duration-300", className)}>
      {/* Questions List */}
      <div className="space-y-2 p-2 bg-muted/5 rounded-xl border border-border/20">
        <h4 className="text-xs font-bold  flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          Interview Questions ({questions.length})
        </h4>
        {questions.length > 0 ? (
          <ol className="pl-4 list-decimal space-y-2">
            {questions.map((q, idx) => (
              <li key={idx} className="text-xs text-foreground/80 leading-relaxed">
                <SingleQuestionDisplay question={q} variant="simple" />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground italic pl-1">No normal questions included.</p>
        )}
      </div>

      {/* MCQs List */}
      {mcqs.length > 0 && (
        <div className="space-y-2 p-2 rounded-xl border border-border/20 bg-muted/5">
          <h4 className="text-xs font-bold  flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-primary shrink-0" />
            Multiple Choice Questions (MCQs) ({mcqs.length})
          </h4>
          <ol className="pl-4 list-decimal space-y-2">
            {mcqs.map((mcq, idx) => (
              <li key={idx} className="space-y-1 text-xs text-foreground/80 leading-relaxed">
                <MCQQuestionDisplay mcq={mcq} variant="simple" />
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Project Tasks List */}
      {project_task.length > 0 && (
        <div className="space-y-2 p-2 rounded-xl border border-border/20 bg-muted/5">
          <h4 className="text-xs font-bold  flex items-center gap-1.5">
            <Loader2 className="h-4 w-4 text-violet-500 shrink-0" />
            Project Tasks ({project_task.length})
          </h4>
          <ol className="pl-4 list-decimal space-y-2">
            {project_task.map((task, idx) => (
              <li key={idx} className="space-y-1 text-xs text-foreground/80 leading-relaxed">
                <ProjectTaskDisplay task={task} variant="simple" showTypeSuffix={false} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
