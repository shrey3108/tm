import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { CandidateTestPaperRead } from "@/types/taskPaper";

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
          Change / Re-assign Paper
        </Button>
      </div>

      {/* Questions List */}
      <div className="space-y-1 p-2">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Interview Questions
        </h4>
        {assignedPaper.questions && assignedPaper.questions.length > 0 ? (
          <ul className="pl-3 list-decimal">
            {assignedPaper.questions.map((q, idx) => (<li key={idx}>{q}</li>))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground italic pl-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            Extracting questions...
          </div>
        )}
      </div>

      {/* Project Task */}
      {assignedPaper.project_task && assignedPaper.project_task.length > 0 && (
        <div className="space-y-1 p-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Project Tasks
          </h4>
          <ul className="pl-3 list-decimal space-y-1">
            {assignedPaper.project_task.map((task, idx) => (
              <li key={idx} className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {task}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
