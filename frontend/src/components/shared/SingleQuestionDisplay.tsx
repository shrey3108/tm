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
      <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4 w-full text-xs">
        <div className="min-w-0">
          <p className={cn("text-foreground text-wrap wrap-break-word", titleClassName)}>{qText}</p>
          {showTypeSuffix && (
            <span className="text-xs block mt-0.5 text-muted-foreground">
              (Normal Question)
            </span>
          )}
        </div>
        <div className="shrink-0 text-left whitespace-nowrap text-xs self-start pt-0.5">
          Marks: {qMarks ?? "N/A"} • Duration: {qDuration !== undefined && qDuration > 0 ? `${qDuration} mins` : "N/A"}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4 w-full">
      <div className="min-w-0">
        <div className={cn("text-foreground text-wrap wrap-break-word", titleClassName)}>{qText}</div>
      </div>
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 text-xs select-none whitespace-nowrap self-start">
        <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
          <Award className="h-2.5 w-2.5" /> {qMarks !== undefined ? `${qMarks} Marks` : "N/A Marks"}
        </span>
        <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
          <Clock className="h-2.5 w-2.5" /> {qDuration !== undefined && qDuration > 0 ? formatDuration(qDuration) : "N/A"}
        </span>
      </div>
    </div>
  );
}
