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
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Interview Questions
        </h4>
        {assignedPaper.questions && assignedPaper.questions.length > 0 ? (
          <ul className="space-y-3 pl-1">
            {assignedPaper.questions.map((q, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-xs font-black text-primary select-none bg-primary/10 border border-primary/20 h-3 w-3 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {q}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground italic pl-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            Extracting questions...
          </div>
        )}
      </div>

      {/* Project Task */}
      {assignedPaper.project_task && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Project Task Description
          </h4>
          <div className="p-2 rounded-xl border border-border/40 bg-card/40 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {assignedPaper.project_task}
          </div>
        </div>
      )}
    </div>
  );
}
