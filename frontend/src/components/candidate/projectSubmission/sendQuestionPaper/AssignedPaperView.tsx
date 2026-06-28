import { Button } from "@/components/ui/button";
import type { CandidateTestPaperRead } from "@/types/taskPaper";
import { PaperContentDisplay } from "@/components/shared/PaperContentDisplay";

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

      <div className="p-2 border border-border/40 rounded-xl bg-card">
        <PaperContentDisplay
          questions={assignedPaper.questions}
          mcqs={assignedPaper.mcqs}
          project_task={assignedPaper.project_task}
        />
      </div>
    </div>
  );
}
