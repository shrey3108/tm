import { DateDisplay } from "@/components/shared/DateDisplay"
import { MessageSquare } from "lucide-react";
import type { CandidateDecision } from "@/apis/candidateDecision";
import { CandidateStatusBadge } from "@/components/shared";

/**
 * Props for {@link HrDecision}.
 */
interface HrDecisionProps {
  decision: CandidateDecision;
}

/**
 * Read-only card that shows the HR decision (approve / reject / maybe),
 * the optional note, and the decision date. Rendered inside the analysis tab
 * when a decision already exists.
 */
export function HrDecision({ decision }: HrDecisionProps) {
  return (
    <section className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          HR Decision
        </h3>
        <CandidateStatusBadge status={decision.decision.toUpperCase()} />
      </div>
      {decision.notes ? (
        <p className="text-sm text-muted-foreground italic leading-relaxed">
          &ldquo;{decision.notes}&rdquo;
        </p>
      ) : (
        <p className="text-xs text-muted-foreground italic">No note provided.</p>
      )}
      <div className="text-[10px]  font-medium">
        Decided on <DateDisplay date={decision.decided_at} className="text-[10px]" />
      </div>
    </section>
  );
}
