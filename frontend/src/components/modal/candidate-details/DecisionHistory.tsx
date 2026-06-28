import { Card } from "@/components/ui/card";
import { History, MessageSquare } from "lucide-react";
import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";
import { DateDisplay } from "@/components/shared/DateDisplay";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";
import { StarRating } from "@/components/shared/StarRating";

interface DecisionHistoryProps {
  decisions: HrDecisionHistoryItem[];
}

export function DecisionHistory({ decisions }: DecisionHistoryProps) {
  if (decisions.length === 0) {
    return null;
  }

  // If there's only 1 decision and it's 'pass' or 'fail', don't show history
  if (decisions.length === 1 && decisions[0].decision.toLowerCase() !== "may be") {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          <History className="h-4 w-4" />
          HR Decision History
        </h3>
        <span className="text-xs font-medium text-muted-foreground">
          {decisions.length} record{decisions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2">
        {decisions.map((decision, index) => (
          <Card
            key={decision.id}
            className="rounded-2xl border-muted-foreground/10 bg-card/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  #{decisions.length - index}
                </span>
                <CandidateStatusBadge status={decision.decision} />
                {decision.score !== undefined && decision.score > 0 && (
                  <StarRating rating={decision.score} size="sm" />
                )}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Decided on <DateDisplay date={decision.decided_at} className="text-[11px]" />
              </span>
            </div>

            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              {decision.notes ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {decision.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No note provided.</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
