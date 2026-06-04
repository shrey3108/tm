import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { Badge } from "@/components";
import { CandidateStatusBadge, DateDisplay } from "@/components/shared";
import { isEventCompleted, isEventOngoing, isEventPending } from "./timelineStatusUtils";
import type { TimelineEvent } from "@/types/candidate";



interface TimelineCardProps {
  event: TimelineEvent;
  /** Whether this card's stage is the one currently selected in the UI. */
  isSelected: boolean;
  /** Whether this card appears after a rejected stage (greyed-out). */
  isAfterRejection: boolean;
  /** Whether this is the real "current" stage the candidate is on. */
  isActuallyActive: boolean;
  onClick: () => void;
}



export const TimelineCard = React.memo(function TimelineCard({
  event,
  isSelected,
  isAfterRejection,
  isActuallyActive,
  onClick,
}: TimelineCardProps) {
  // @ts-ignore
  const _completed = isEventCompleted(event.result);
  const ongoing = isEventOngoing(event.result);
  const pending = isEventPending(event.result);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "flex w-[250px] flex-col p-2.5 gap-1.5 shrink-0 border cursor-pointer hover:border-primary/50 transition-all",
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20 scale-[1.02]"
          : ongoing
            ? "border-primary/40 bg-primary/5"
            : "border-muted-foreground/10 bg-card hover:bg-muted/30",
        isAfterRejection && "opacity-40 grayscale-[0.5]",
      )}
    >
      {/* Title + current badge */}
      <div className="space-y-1 min-h-[38px]">
        <div className="flex items-center justify-between gap-2">
          <h4
            className={cn(
              "font-black text-xs text-wrap line-clamp-1",
              isSelected
                ? "text-black font-bold dark:text-white"
                : pending
                  ? "text-foreground"
                  : "text-foreground/90",
            )}
            title={event.title}
          >
            {event.title}
          </h4>
          {isActuallyActive && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-primary/30 font-black uppercase tracking-tighter whitespace-nowrap"
            >
              Current
            </Badge>
          )}
        </div>
        <p
          className={cn(
            "text-xs font-bold uppercase tracking-tighter flex items-center gap-1",
            pending ? "text-foreground/70" : "text-muted-foreground",
          )}
        >
          {event.event_date && (
            <>
              <Calendar className="h-2.5 w-2.5" />
              <DateDisplay date={new Date(event.event_date)} className="text-xs" />
            </>
          )}
        </p>
      </div>

      {/* AI result + HR decision */}
      <div className="pt-1.5 border-t border-muted-foreground/10 mt-auto">
        <div className="flex flex-col gap-2 min-h-[54px]">
          {event.ai_result && (
            <div className="flex items-center justify-start gap-2">
              <span className="text-xs font-bold uppercase tracking-tight text-muted-foreground">
                AI result:
              </span>
              <CandidateStatusBadge status={event.ai_result?.replace("ed", "") || "N/A"} />
              {event.score !== null && event.score !== undefined && (
                <span className="text-xs font-bold ">
                  {event.score}
                  {event.title !== "Resume Screening" ? "/5" : "%"}
                </span>
              )}
            </div>
          )}

          {event.hr_decision && (
            <div className="flex items-center justify-start gap-2">
              <span className="text-xs font-bold uppercase tracking-tight text-muted-foreground">
                HR decision:
              </span>
              <CandidateStatusBadge status={event.hr_decision?.replace("ed", "") || "N/A"} />
              {event.hr_score !== null && event.hr_score !== undefined && (
                <span className="text-xs font-bold ">
                  {event.hr_score}/5
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});
