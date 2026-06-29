import { Award, Clock } from "lucide-react";
import type { MCQItem } from "@/types/taskPaper";
import { formatDuration } from "@/utils/taskFormatter";
import { cn } from "@/lib/utils";

export interface MCQQuestionDisplayProps {
  mcq: MCQItem;
  variant?: "simple" | "detailed";
  titleClassName?: string;
  showTypeSuffix?: boolean;
}

export function MCQQuestionDisplay({
  mcq,
  variant = "simple",
  titleClassName,
  showTypeSuffix,
}: MCQQuestionDisplayProps) {
  const mMarks = mcq.marks;
  const mDuration = mcq.duration;
  const options = mcq.options || [];

  if (variant === "simple") {
    return (
      <div className="flex items-start justify-between gap-4 w-full">
        <div className="flex-1 min-w-0">
          <p className={cn("text-foreground text-wrap wrap-break-word", titleClassName)}>{mcq.question}</p>
          {options.length > 0 && (
            <p className="text-xs text-wrap wrap-break-word mt-0.5">
              Options: {options.join(" | ")}
            </p>
          )}
          {showTypeSuffix && (
            <span className="text-xs block mt-0.5">
              {mcq.answer && `Correct: ${mcq.answer} • `}(MCQ)
            </span>
          )}
        </div>
        <div className="shrink-0 text-right whitespace-nowrap text-xs self-start pt-0.5">
          Marks: {mMarks ?? 5} • Duration: {mDuration ?? 3} mins
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 w-full">
      <div className="flex-1 min-w-0 space-y-1">
        <span className={cn("text-foreground block text-wrap wrap-break-word", titleClassName)}>{mcq.question}</span>
        <div className="flex flex-wrap gap-1">
          {options.map((opt, optIdx) => (
            <span
              key={optIdx}
              className={cn(
                "text-xs px-1.5 py-0.5 rounded border scale-95 origin-left",
                opt === mcq.answer
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : "bg-muted/30 border-border/30"
              )}
            >
              {String.fromCharCode(65 + optIdx)}: {opt}
            </span>
          ))}
        </div>
      </div>
      {(mMarks !== undefined || (mDuration !== undefined && mDuration > 0)) && (
        <div className="shrink-0 flex items-center gap-1.5 text-xs select-none whitespace-nowrap self-start">
          {mMarks !== undefined && (
            <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
              <Award className="h-2.5 w-2.5" /> {mMarks} Marks
            </span>
          )}
          {mDuration !== undefined && mDuration > 0 && (
            <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
              <Clock className="h-2.5 w-2.5" /> {formatDuration(mDuration)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
