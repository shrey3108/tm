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
  variant = "detailed",
  titleClassName,
  showTypeSuffix,
}: MCQQuestionDisplayProps) {
  const mMarks = mcq.marks;
  const mDuration = mcq.duration;
  const options = mcq.options || [];

  if (variant === "simple") {
    return (
      <div className="text-xs">
        <p className={cn("font-medium text-foreground", titleClassName)}>{mcq.question}</p>
        <p className="text-[10px] text-muted-foreground font-semibold">
          Options: {options.join(" | ")}
        </p>
        <span className="text-[10px] text-muted-foreground font-semibold">
          {showTypeSuffix && mcq.answer && `Correct: ${mcq.answer} • `}
          Marks: {mMarks ?? 5} • Duration: {mDuration ?? 3} mins
          {showTypeSuffix && " (MCQ)"}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className={cn("font-medium text-foreground block", titleClassName)}>{mcq.question}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt, optIdx) => (
          <span
            key={optIdx}
            className={cn(
              "text-xs px-1.5 py-0.5 rounded border scale-95 origin-left",
              opt === mcq.answer
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : "bg-muted/30 text-muted-foreground border-border/30"
            )}
          >
            {String.fromCharCode(65 + optIdx)}: {opt}
          </span>
        ))}
      </div>
      {(mMarks !== undefined || (mDuration !== undefined && mDuration > 0)) && (
        <div className="flex flex-wrap gap-1 mt-1 text-xs select-none">
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
