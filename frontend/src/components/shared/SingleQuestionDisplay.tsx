import { Award, Clock } from "lucide-react";
import type { QuestionItem } from "@/types/taskPaper";
import { formatDuration } from "@/utils/taskFormatter";
import { cn } from "@/lib/utils";

export interface SingleQuestionDisplayProps {
  question: QuestionItem | string;
  variant?: "simple" | "detailed";
  titleClassName?: string;
  showTypeSuffix?: boolean;
}

export function SingleQuestionDisplay({
  question,
  variant = "detailed",
  titleClassName,
  showTypeSuffix,
}: SingleQuestionDisplayProps) {
  const qText = typeof question === "string" ? question : question.question || "";
  const qMarks = typeof question === "string" ? undefined : question.marks;
  const qDuration = typeof question === "string" ? undefined : question.duration;

  if (variant === "simple") {
    return (
      <div className="text-xs">
        <p className={cn("font-medium text-foreground", titleClassName)}>{qText}</p>
        <span className="text-[10px] text-muted-foreground font-semibold">
          Marks: {qMarks ?? 5} • Duration: {qDuration ?? 3} mins
          {showTypeSuffix && " (Normal Question)"}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className={cn("font-medium text-foreground", titleClassName)}>{qText}</div>
      {(qMarks !== undefined || (qDuration !== undefined && qDuration > 0)) && (
        <div className="flex flex-wrap gap-1 mt-1 text-xs select-none">
          {qMarks !== undefined && (
            <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
              <Award className="h-2.5 w-2.5" /> {qMarks} Marks
            </span>
          )}
          {qDuration !== undefined && qDuration > 0 && (
            <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
              <Clock className="h-2.5 w-2.5" /> {formatDuration(qDuration)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
