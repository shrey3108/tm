import { CheckCircle2, ListChecks, Award, Clock, Loader2 } from "lucide-react";
import type { QuestionItem, MCQItem, TaskItem } from "@/types/taskPaper";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/taskFormatter";

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
      <div className="space-y-1 p-2 bg-muted/5 rounded-xl border border-border/20">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          Interview Questions ({questions.length})
        </h4>
        {questions.length > 0 ? (
          <ol className="pl-4 list-decimal space-y-2">
            {questions.map((q, idx) => {
              const qText = typeof q === "string" ? q : q.question || "";
              const qMarks = typeof q === "string" ? undefined : q.marks;
              const qDuration = typeof q === "string" ? undefined : q.duration;
              return (
                <li key={idx} className="text-xs text-foreground/80 leading-relaxed">
                  <div className="font-medium text-foreground">{qText}</div>
                  {(qMarks !== undefined || (qDuration !== undefined && qDuration > 0)) && (
                    <div className="flex flex-wrap gap-1 mt-1 font-bold text-[9px] select-none">
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
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground italic pl-1">No normal questions included.</p>
        )}
      </div>

      {/* MCQs List */}
      {mcqs.length > 0 && (
        <div className="space-y-2 p-2 rounded-xl border border-border/20 bg-muted/5">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-primary shrink-0" />
            Multiple Choice Questions (MCQs) ({mcqs.length})
          </h4>
          <ol className="pl-4 list-decimal space-y-2">
            {mcqs.map((mcq, idx) => {
              const mMarks = mcq.marks;
              const mDuration = mcq.duration;
              return (
                <li key={idx} className="space-y-1 text-xs text-foreground/80 leading-relaxed">
                  <span className="font-medium text-foreground block">{mcq.question}</span>
                  <div className="flex flex-wrap gap-1">
                    {mcq.options.map((opt, optIdx) => (
                      <span
                        key={optIdx}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border scale-95 origin-left",
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
                    <div className="flex flex-wrap gap-1 mt-1 font-bold text-[9px] select-none">
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
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Project Tasks List */}
      {project_task.length > 0 && (
        <div className="space-y-2 p-2 rounded-xl border border-border/20 bg-muted/5">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Loader2 className="h-4 w-4 text-violet-500 shrink-0" />
            Project Tasks ({project_task.length})
          </h4>
          <ol className="pl-4 list-decimal space-y-2">
            {project_task.map((task, idx) => {
              const isString = typeof task === "string";
              const taskText = isString ? task : task?.task || task?.title || "";
              const instructions = isString ? "" : task?.instructions || "";
              const tDuration = isString ? undefined : task?.duration || task?.total_duration;
              const subTasks = isString ? [] : task?.tasks || [];

              return (
                <li key={idx} className="space-y-1 text-xs text-foreground/80 leading-relaxed">
                  <div className="font-medium text-foreground whitespace-pre-wrap">{taskText}</div>
                  {instructions && (
                    <div className="pl-2 space-y-0.5 border-l border-border/50">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Instructions
                      </span>
                      <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{instructions}</p>
                    </div>
                  )}
                  {subTasks.length > 0 && (
                    <div className="pl-2 space-y-0.5">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Sub-tasks
                      </span>
                      <ul className="list-disc pl-3 text-[11px] text-muted-foreground space-y-0.5">
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
                    <div className="flex flex-wrap gap-1 mt-1 font-bold text-[9px] select-none">
                      <span className="inline-flex items-center gap-0.5 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full">
                        <Clock className="h-2.5 w-2.5" /> Duration: {formatDuration(tDuration)}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
