import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ListChecks, Award, Clock } from "lucide-react";
import type { CandidateTestPaperRead } from "@/types/taskPaper";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/taskFormatter";

interface AssignedPaperViewProps {
  assignedPaper: CandidateTestPaperRead;
  onUnassign: () => Promise<void> | void;
  isUnassigning: boolean;
}

export function AssignedPaperView({
  assignedPaper,
  onUnassign,
  isUnassigning,
}: AssignedPaperViewProps) {
  return (
    <div className="space-y-1.5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded-xl border border-primary/20 bg-primary/5">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Assigned Test Paper
          </span>
          <h3 className="text-base font-bold text-foreground capitalize">
            {assignedPaper.name}
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onUnassign}
          disabled={isUnassigning}
          className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all font-semibold"
        >
          Change Existing Paper
        </Button>
      </div>

      {/* Questions List */}
      <div className="space-y-1 p-2">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Interview Questions
        </h4>
        {assignedPaper.questions && assignedPaper.questions.length > 0 ? (
          <ul className="pl-3 list-decimal space-y-2.5">
            {assignedPaper.questions.map((q, idx) => {
              const qText = typeof q === "string" ? q : q.question || "";
              const qMarks = typeof q === "string" ? undefined : q.marks;
              const qDuration = typeof q === "string" ? undefined : q.duration;
              return (
                <li key={idx} className="text-xs text-foreground/80 leading-relaxed">
                  <div className="font-medium">{qText}</div>
                  {(qMarks !== undefined || (qDuration !== undefined && qDuration > 0)) && (
                    <div className="flex flex-wrap gap-1.5 mt-1 font-bold text-[9px] select-none">
                      {qMarks !== undefined && (
                        <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
                          <Award className="h-2.5 w-2.5" /> {qMarks} Marks
                        </span>
                      )}
                      {qDuration !== undefined && qDuration > 0 && (
                        <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
                          <Clock className="h-2.5 w-2.5" /> {formatDuration(qDuration)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground italic pl-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            Extracting questions...
          </div>
        )}
      </div>

      {/* MCQs List */}
      {assignedPaper.mcqs && assignedPaper.mcqs.length > 0 && (
        <div className="space-y-2 p-2 border-t border-border/40 pt-4 mt-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Multiple Choice Questions (MCQs)
          </h4>
          <ol className="pl-3 list-decimal space-y-3.5">
            {assignedPaper.mcqs.map((mcq, idx) => {
              const mMarks = mcq.marks;
              const mDuration = mcq.duration;
              return (
                <li key={idx} className="space-y-1.5">
                  <span className="text-xs font-semibold text-foreground/90 leading-relaxed block">
                    {mcq.question}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {mcq.options.map((opt, optIdx) => (
                      <span
                        key={optIdx}
                        className={cn(
                          "text-sm px-1.5 py-0.5 rounded border scale-95 origin-left",
                          opt === mcq.answer
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold"
                            : "bg-muted/30 text-muted-foreground border-border/30"
                        )}
                      >
                        {String.fromCharCode(65 + optIdx)}: {opt}
                      </span>
                    ))}
                  </div>
                  {(mMarks !== undefined || (mDuration !== undefined && mDuration > 0)) && (
                    <div className="flex flex-wrap gap-1.5 mt-1 font-bold text-[9px] select-none">
                      {mMarks !== undefined && (
                        <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
                          <Award className="h-2.5 w-2.5" /> {mMarks} Marks
                        </span>
                      )}
                      {mDuration !== undefined && mDuration > 0 && (
                        <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
                          <Clock className="h-2.5 w-2.5" /> {formatDuration(mDuration)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Project Task */}
      {assignedPaper.project_task && assignedPaper.project_task.length > 0 && (
        <div className="space-y-2 p-2 border-t border-border/40 pt-4 mt-2">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Project Tasks
          </h4>
          <ul className="pl-3 list-decimal space-y-4">
            {assignedPaper.project_task.map((task, idx) => {
              const isString = typeof task === "string";
              const taskText = isString ? task : task?.task || "";
              const instructions = isString ? "" : task?.instructions || "";
              return (
                <li key={idx} className="space-y-2.5">
                  <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-semibold">
                    {taskText}
                  </div>
                  {instructions && (
                    <div className="pl-3 space-y-0.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Instructions</span>
                      <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {instructions}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
