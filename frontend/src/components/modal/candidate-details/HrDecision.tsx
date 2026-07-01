import { DateDisplay } from "@/components/shared/DateDisplay"
import { MessageSquare } from "lucide-react";
import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";
import { StarRating } from "@/components/shared/StarRating";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";


/**
 * Props for {@link HrDecision}.
 */
interface HrDecisionProps {
  decision: HrDecisionHistoryItem;
}

/**
 * Read-only card that shows the HR decision (approve / reject / maybe),
 * the optional note, and the decision date. Rendered inside the analysis tab
 * when a decision already exists.
 */
export function HrDecision({ decision }: HrDecisionProps) {
  return (
    <section className="px-4 py-2 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase text-primary flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          HR Decision
        </h3>
        <div className="flex items-center gap-2">
          {decision.score !== undefined && decision.score > 0 && (
            <StarRating rating={decision.score} size="sm" />
          )}
          <CandidateStatusBadge status={decision.decision.toUpperCase()} />
        </div>
      </div>
      {decision.notes ? (
        <div className="flex items-end gap-2">
          <p className="text-sm text-muted-foreground flex-1 break-all">
            &ldquo;{decision.notes}&rdquo;
          </p>
          <div className="text-xs font-medium shrink-0">
            Decided on <DateDisplay date={decision.decided_at} className="text-xs" />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No note provided.</p>
      )}
    </section>
  );
}
